"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp, FileText, GraduationCap, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  generateRecordingSummary,
  generateRecordingTranscript,
  getRecordingAiAnalysis,
} from "@/lib/api/teacher";
import {
  generateDocumentTranscript,
  getDocumentAiAnalysis,
} from "@/lib/api/document";

type TranscriptPayload =
  | string
  | {
      full_text?: unknown;
      text?: unknown;
      transcript?: unknown;
      result?: unknown;
      payload?: unknown;
      data?: unknown;
      language?: unknown;
      timestamps?: unknown[];
      segments?: unknown[];
    };

interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

type ProcessingStage = 'queued' | 'preparing' | 'transcribing' | 'summarizing' | 'moderating' | 'done' | 'error';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const extractTranscriptTextValue = (value: unknown, depth = 0): string => {
  if (depth > 8 || value == null) return '';

  if (typeof value === 'string') return value.trim();

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTranscriptTextValue(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (!isPlainObject(value)) return '';

  const data = value as Record<string, unknown>;
  const directCandidates = [data.text, data.full_text, data.transcript, data.result, data.payload, data.data];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === 'object') {
      const nested = extractTranscriptTextValue(candidate, depth + 1);
      if (nested) return nested;
    }
  }

  const topLevelBlocks = Array.isArray(data.timestamps)
    ? data.timestamps
    : Array.isArray(data.segments)
      ? data.segments
      : null;

  if (topLevelBlocks) {
    const text = topLevelBlocks
      .map((item) => extractTranscriptTextValue(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return text;
  }

  for (const nestedValue of Object.values(data)) {
    const nested = extractTranscriptTextValue(nestedValue, depth + 1);
    if (nested) return nested;
  }

  return '';
};

const collectTranscriptSegments = (payload: unknown, depth = 0): Array<Record<string, unknown>> => {
  if (depth > 8 || payload == null) return [];

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectTranscriptSegments(item, depth + 1));
  }

  if (!isPlainObject(payload)) return [];

  const data = payload as Record<string, unknown>;
  const collected: Array<Record<string, unknown>> = [];

  const blocks = Array.isArray(data.timestamps)
    ? data.timestamps
    : Array.isArray(data.segments)
      ? data.segments
      : [];

  for (const block of blocks) {
    if (isPlainObject(block)) collected.push(block);
  }

  for (const key of ['transcript', 'result', 'payload', 'data']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      collected.push(...collectTranscriptSegments(nested, depth + 1));
    }
  }

  return collected;
};

const extractCueText = (segment: Record<string, unknown>): string => {
  const textCandidate = [
    segment.text,
    segment.full_text,
    segment.transcript,
    segment.result,
    segment.payload,
  ].find((value) => typeof value === 'string');
  return typeof textCandidate === 'string' ? textCandidate.trim() : '';
};

const extractCueStart = (segment: Record<string, unknown>, fallbackStart: number): number => {
  const start =
    typeof segment.start === 'number'
      ? segment.start
      : typeof segment.start_time === 'number'
        ? segment.start_time
        : typeof segment.startTime === 'number'
          ? segment.startTime
          : Number.NaN;

  return Number.isFinite(start) ? Math.max(0, start) : fallbackStart;
};

const extractCueEnd = (segment: Record<string, unknown>): number | null => {
  const end =
    typeof segment.end === 'number'
      ? segment.end
      : typeof segment.end_time === 'number'
        ? segment.end_time
        : typeof segment.endTime === 'number'
          ? segment.endTime
          : Number.NaN;

  return Number.isFinite(end) ? Math.max(0, end) : null;
};

const normalizeTranscriptContent = (transcript: TranscriptPayload | null | undefined): string => {
  return extractTranscriptTextValue(transcript);
};

interface TranscriptSummaryStudioProps {
  transcriptSeedMessage: string;
  transcriptHint?: string;
  transcriptEmptyText?: string;
  summaryEmptyText?: string;
  className?: string;
  recordingId?: string;
  documentId?: string;
}

export default function TranscriptSummaryStudio({
  transcriptSeedMessage,
  transcriptHint = "Click \"Generate Transcript\" to convert video audio to text. The \"Summarize\" button activates when transcript is ready.",
  transcriptEmptyText = "No transcript yet.",
  summaryEmptyText = "Summary will be shown here after you click Summarize.",
  className = "",
  recordingId,
  documentId,
}: TranscriptSummaryStudioProps) {
  const [transcriptContent, setTranscriptContent] = useState("");
  const [summaryContent, setSummaryContent] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processingStage, setProcessingStage] = useState<ProcessingStage | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);

  const transcriptPanelRef = useRef<HTMLDivElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevents concurrent generate calls (double-click, React StrictMode, etc.)
  const isGeneratingRef = useRef(false);

  const isDocumentMode = !!documentId && !recordingId;
  const canSummarize = !isDocumentMode && transcriptContent.trim().length > 0;
  const hasTranscript = transcriptContent.trim().length > 0 || transcriptStatus === 'success';
  const hasSummary = summaryContent.trim().length > 0;
  const canRegenerateTranscript = hasTranscript || hasSummary;
  const canRetry = transcriptStatus === 'error' || !!processingError || processingStage === 'error';

  const transcriptStatusNotice = (() => {
    if (transcriptStatus === 'processing') {
      return {
        className: 'border-sky-200 bg-sky-50 text-sky-700',
        text: `We are still working on your transcript (${elapsedSeconds}s). You can leave this page and come back later.`,
      };
    }

    if (hasTranscript && !canRetry) {
      return {
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        text: 'Transcript already exists.',
      };
    }

    return null;
  })();

  const normalizeProgress = (value: unknown): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  };

  const normalizeStage = (value: unknown): ProcessingStage | null => {
    const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (stage === 'queued') return 'queued';
    if (stage === 'preparing') return 'preparing';
    if (stage === 'transcribing') return 'transcribing';
    if (stage === 'summarizing') return 'summarizing';
    if (stage === 'moderating') return 'moderating';
    if (stage === 'done') return 'done';
    if (stage === 'error') return 'error';
    return null;
  };

  const inferProgress = (analysis: {
    transcript?: TranscriptPayload | null;
    summary?: string | null;
    transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
    processingStage?: string | null;
    processingProgress?: number | null;
    processingError?: string | null;
  }) => {
    if (typeof analysis.processingProgress === 'number') return normalizeProgress(analysis.processingProgress);
    if (analysis.processingStage === 'done') return 100;
    if (analysis.processingStage === 'moderating') return 85;
    if (analysis.processingStage === 'summarizing') return 60;
    if (analysis.processingStage === 'transcribing') return 35;
    if (analysis.processingStage === 'preparing') return 10;
    if (analysis.transcriptStatus === 'success' && analysis.summary) return 85;
    if (analysis.transcriptStatus === 'success' && analysis.transcript) return 60;
    if (analysis.transcriptStatus === 'processing') return 35;
    if (analysis.transcriptStatus === 'error' || analysis.processingError) return 0;
    return 0;
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const startElapsedTimer = () => {
    if (elapsedTimerRef.current) return;
    setElapsedSeconds(0);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  };

  const coerceNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const s = Math.round(seconds);
    const minutes = Math.floor(s / 60);
    const secs = s % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const splitTextToCues = (text: string, totalDuration: number): SubtitleCue[] => {
    const source = (text || '').replace(/\s+/g, ' ').trim();
    if (!source) return [];
    const parts = source.split(/(?<=[.!?])\s+/).filter(Boolean);
    const safeDuration = totalDuration > 0 ? totalDuration : parts.length * 4;
    const cueDuration = Math.max(2.5, Math.floor(safeDuration / Math.max(1, parts.length)));
    return parts.map((part, index) => ({
      id: `cue-${index + 1}`,
      start: index * cueDuration,
      end: (index + 1) * cueDuration,
      text: part,
    }));
  };

  const buildCuesFromTranscript = (payload: TranscriptPayload | null | undefined, totalDuration: number): SubtitleCue[] => {
    if (!payload) return [];
    if (typeof payload === 'string') return splitTextToCues(payload, totalDuration);

    if (typeof payload !== 'object' || Array.isArray(payload)) {
      return splitTextToCues(extractTranscriptTextValue(payload), totalDuration);
    }

    const transcript = payload as Record<string, unknown>;
    const blocks = Array.isArray(transcript.timestamps)
      ? transcript.timestamps
      : Array.isArray(transcript.segments)
        ? transcript.segments
        : [];

    if (blocks.length === 0) {
      return splitTextToCues(extractTranscriptTextValue(payload), totalDuration);
    }

    const normalized = blocks
      .map((block, index) => {
        if (!isPlainObject(block)) return null;
        const text = extractCueText(block);
        if (!text) return null;

        return {
          id: `cue-${index + 1}`,
          start: extractCueStart(block, index * 4),
          end: extractCueEnd(block),
          text,
        };
      })
      .filter((item): item is { id: string; start: number; end: number | null; text: string } => !!item);

    if (normalized.length === 0) {
      return splitTextToCues(extractTranscriptTextValue(payload), totalDuration);
    }

    return normalized.map((segment, index) => {
      const nextStart = normalized[index + 1]?.start ?? null;
      const end = segment.end ?? (nextStart != null ? nextStart : segment.start + 4);

      return {
        id: segment.id,
        start: segment.start,
        end,
        text: segment.text,
      };
    });
  };

  const applyAnalysis = (analysis: {
    transcript?: TranscriptPayload | null;
    summary?: string | null;
    transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
    transcriptError?: string | null;
    processingStage?: string | null;
    processingProgress?: number | null;
    processingError?: string | null;
  }) => {
    const transcriptText = normalizeTranscriptContent(analysis.transcript);

    setTranscriptContent(transcriptText);
    setSummaryContent(analysis.summary || "");
    setProcessingStage(normalizeStage(analysis.processingStage));
    setProcessingProgress(inferProgress(analysis));
    setProcessingError(analysis.processingError || null);

    const nextStatus = analysis.transcriptStatus || (transcriptText ? 'success' : 'idle');
    setTranscriptStatus(nextStatus);
    setTranscriptError(nextStatus === 'error' ? analysis.transcriptError || "Cannot generate transcript right now." : null);

    const isProcessing = nextStatus === 'processing';

    // Always sync isTranscribing with the actual server status.
    // applyAnalysis is the single source of truth — the finally block in
    // handleGenerateTranscript must NOT override this.
    setIsTranscribing(isProcessing);

    if (!isProcessing) {
      stopPolling();
      if (nextStatus === 'success' && analysis.transcript) {
        console.log('[Transcription Success]', {
          recordingId,
          documentId,
          transcriptLength: transcriptText.length,
          hasTranscript: !!transcriptText,
          hasSummary: !!analysis.summary,
          status: nextStatus,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      startElapsedTimer();
    }

    try {
      const cues = buildCuesFromTranscript(analysis.transcript as TranscriptPayload | null | undefined, 0);
      setSubtitleCues(cues);
    } catch {
      // non-fatal
    }

    return isProcessing;
  };

  const fetchCurrentAnalysis = async () => {
    if (recordingId) {
      const analysis = await getRecordingAiAnalysis(recordingId);
      return applyAnalysis(analysis);
    }
    if (documentId) {
      const analysis = await getDocumentAiAnalysis(documentId);
      return applyAnalysis(analysis);
    }
    return false;
  };

  const startPolling = () => {
    if (pollTimerRef.current) return;
    startElapsedTimer();
    pollTimerRef.current = setInterval(async () => {
      try {
        const isProcessing = await fetchCurrentAnalysis();
        if (!isProcessing) stopPolling();
      } catch (err) {
        console.error("Failed to refresh AI analysis:", err);
      }
    }, 5000);
  };

  useEffect(() => {
    const loadExistingAnalysis = async () => {
      if (!recordingId && !documentId) return;
      try {
        setIsLoadingExisting(true);
        const isProcessing = await fetchCurrentAnalysis();
        if (isProcessing) startPolling();
      } catch (err) {
        console.error("Failed to load existing AI analysis:", err);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    loadExistingAnalysis();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [documentId, recordingId]);

  useEffect(() => {
    if (!subtitleCues.length) {
      setActiveCueId(null);
      return;
    }
    const timer = setInterval(() => {
      const video = document.querySelector('video[controls]') as HTMLVideoElement | null;
      if (!video || Number.isNaN(video.currentTime)) return;
      const cue = subtitleCues.find((item) => video.currentTime >= item.start && video.currentTime < item.end) || null;
      setActiveCueId(cue?.id || null);
    }, 250);
    return () => clearInterval(timer);
  }, [subtitleCues]);

  useEffect(() => {
    if (!transcriptPanelRef.current || !activeCueId) return;
    const activeEl = transcriptPanelRef.current.querySelector(`[data-cue-id="${activeCueId}"]`);
    activeEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeCueId]);

  const handleGenerateTranscript = async () => {
    // When already processing, clicking refreshes the status from the server.
    if (isTranscribing && transcriptStatus === 'processing') {
      setIsCheckingStatus(true);
      try {
        const isProcessing = await fetchCurrentAnalysis();
        if (!isProcessing) stopPolling();
      } catch (err) {
        console.error("Failed to check status:", err);
      } finally {
        setIsCheckingStatus(false);
      }
      return;
    }

    if (isTranscribing || isCheckingStatus) return;

    // Prevent concurrent calls: double-click, React StrictMode double-invoke, etc.
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    const shouldRetry = canRetry || canRegenerateTranscript;

    try {
      setTranscriptError(null);
      setProcessingError(null);
      setIsRetrying(shouldRetry);
      setIsTranscribing(true);
      if (recordingId || documentId) setTranscriptStatus('processing');
      startElapsedTimer();

      if (recordingId) {
        await generateRecordingTranscript(recordingId, shouldRetry);
        const isProcessing = await fetchCurrentAnalysis();
        if (isProcessing) startPolling();
      } else if (documentId) {
        await generateDocumentTranscript(documentId, shouldRetry);
        const isProcessing = await fetchCurrentAnalysis();
        if (isProcessing) startPolling();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 900));
        setTranscriptContent(transcriptSeedMessage);
        setSummaryContent("");
        setTranscriptStatus('success');
        setIsTranscribing(false);
      }
    } catch (err) {
      console.error("Failed to generate transcript:", err);
      const message = err instanceof Error ? err.message : "Cannot generate transcript right now.";
      setTranscriptError(message);
      // Only reset on error — applyAnalysis handles the success/processing path.
      setIsTranscribing(false);
    } finally {
      isGeneratingRef.current = false;
      setIsRetrying(false);
      // Do NOT call setIsTranscribing(false) here.
      // applyAnalysis is the sole controller of isTranscribing based on actual server state.
      // Setting it here would override applyAnalysis and re-enable the button prematurely,
      // causing repeated concurrent calls while the server is still processing.
    }
  };

  const handleSummarize = async () => {
    if (!canSummarize || isSummarizing) return;
    try {
      setIsSummarizing(true);
      if (recordingId) {
        await generateRecordingSummary(recordingId, !!summaryContent.trim());
        await fetchCurrentAnalysis();
      } else if (documentId) {
        setSummaryContent("Document summary is not available yet.");
      } else {
        setSummaryContent("AI summarization service is not connected yet.");
      }
    } catch (err) {
      console.error("Failed to summarize transcript:", err);
      const message = err instanceof Error ? err.message : "Cannot generate summary right now.";
      setTranscriptError(message);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-[#292C6D]/10 bg-linear-to-br from-white via-[#F9FAFF] to-[#EEF2FF] p-6 shadow-sm ${className}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#1F2350]">
            <GraduationCap size={20} className="text-[#292C6D]" />
            Transcript
          </h2>
          <div className="group relative">
            <CircleHelp size={16} className="cursor-help text-gray-400" />
            <div className="pointer-events-none absolute left-6 top-1/2 z-20 w-64 -translate-y-1/2 rounded-lg bg-[#1F2350] px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {transcriptHint}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#292C6D]/10 px-3 py-1 text-xs font-semibold text-[#292C6D]">
          <FileText size={14} />
          Education Mode
        </span>
      </div>

      <div className="rounded-xl border border-[#292C6D]/10 bg-white p-4">
        <button
          type="button"
          onClick={handleGenerateTranscript}
          disabled={
            isCheckingStatus ||
            (isTranscribing && transcriptStatus !== 'processing')
          }
          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            isCheckingStatus || (isTranscribing && transcriptStatus !== 'processing')
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-[#292C6D] text-white hover:bg-[#1f2350]"
          }`}
        >
          {isCheckingStatus ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Checking status...
            </>
          ) : isTranscribing && transcriptStatus !== 'processing' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating transcript...
            </>
          ) : isRetrying ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Retrying process...
            </>
          ) : isTranscribing && transcriptStatus === 'processing' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Click to refresh ({elapsedSeconds}s)
            </>
          ) : canRetry ? (
            <>
              <RefreshCw size={16} />
              Retry process
            </>
          ) : canRegenerateTranscript ? (
            <>
              <FileText size={16} />
              Regenerate Transcript
            </>
          ) : (
            <>
              <FileText size={16} />
              Generate Transcript
            </>
          )}
        </button>

        {transcriptError && (
          <p className="mt-2 text-xs font-medium text-red-600">{transcriptError}</p>
        )}

        {processingError && !transcriptError && (
          <p className="mt-2 text-xs font-medium text-red-600">
            We hit a temporary issue while working on this. Please try again in a moment.
          </p>
        )}

        {transcriptStatusNotice && (
          <p className={`mt-2 text-xs font-medium ${transcriptStatusNotice.className}`}>{transcriptStatusNotice.text}</p>
        )}

        <div
          ref={transcriptPanelRef}
          className="mt-3 h-52 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700"
        >
          {isLoadingExisting && !transcriptContent ? (
            "Loading saved transcript..."
          ) : subtitleCues.length > 0 ? (
            <div className="space-y-2">
              {subtitleCues.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-cue-id={item.id}
                  onClick={() => {
                    setActiveCueId(item.id);
                    try {
                      const ev = new CustomEvent('streamland:transcript-seek', { detail: { start: item.start } });
                      window.dispatchEvent(ev);
                    } catch {
                      try { navigator.clipboard?.writeText(String(item.start)); } catch {}
                    }
                  }}
                  className={`transcript-cue-button w-full rounded-sm px-2 py-2 text-left leading-relaxed transition ${
                    activeCueId === item.id
                      ? 'bg-[#292C6D]/10 text-[#1F2350]'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <div className="inline-flex min-w-14 items-center justify-center rounded bg-slate-200 px-2 py-0.5 text-sm font-semibold text-slate-700">
                    {formatTime(item.start)}
                  </div>
                  <div className="font-medium">{item.text}</div>
                </button>
              ))}
            </div>
          ) : (
            transcriptContent || transcriptEmptyText
          )}
        </div>

        <button
          type="button"
          onClick={handleSummarize}
          disabled={!canSummarize || isSummarizing || isTranscribing || hasSummary}
          className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
            canSummarize && !hasSummary
              ? "bg-[#292C6D] text-white hover:bg-[#1f2350]"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}
        >
          {isSummarizing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Summarize
        </button>

        {hasSummary && (
          <p className="mt-2 text-xs font-medium text-emerald-700">Summary already exists.</p>
        )}

        {!canSummarize && !isDocumentMode && (
          <p className="mt-2 text-xs font-medium text-amber-700">Generate transcript first.</p>
        )}

        {isDocumentMode && !hasSummary && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Summary is not available for documents yet.
          </p>
        )}

        <div className="mt-3 h-44 overflow-y-auto rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
          {summaryContent || summaryEmptyText}
        </div>
      </div>
    </div>
  );
}