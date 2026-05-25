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
      segments?: unknown[];
    };

type ProcessingStage = 'queued' | 'preparing' | 'transcribing' | 'summarizing' | 'moderating' | 'done' | 'error';

const normalizeTranscriptContent = (transcript: TranscriptPayload | null | undefined): string => {
  if (typeof transcript === "string") {
    return transcript.trim();
  }

  if (!transcript || typeof transcript !== "object") {
    return "";
  }

  const data = transcript as Record<string, unknown>;

  const directText = [data.full_text, data.text, data.transcript, data.result].find(
    (value) => typeof value === "string",
  );

  if (typeof directText === "string") {
    return directText.trim();
  }

  if (Array.isArray(data.segments)) {
    const segments = data.segments
      .map((segment) => {
        if (typeof segment === "string") {
          return segment.trim();
        }

        if (!segment || typeof segment !== "object") {
          return "";
        }

        const segmentData = segment as Record<string, unknown>;
        const segmentText = segmentData.text ?? segmentData.full_text ?? segmentData.transcript ?? segmentData.result;

        return typeof segmentText === "string" ? segmentText.trim() : "";
      })
      .filter(Boolean);

    return segments.join("\n").trim();
  }

  return "";
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
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDocumentMode = !!documentId && !recordingId;
  const canSummarize = !isDocumentMode && transcriptContent.trim().length > 0;
  const hasTranscript = transcriptContent.trim().length > 0 || transcriptStatus === 'success';
  const hasSummary = summaryContent.trim().length > 0;
  const canRetry = transcriptStatus === 'error' || !!processingError || processingStage === 'error';

  const normalizeProgress = (value: unknown): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

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
    if (typeof analysis.processingProgress === 'number') {
      return normalizeProgress(analysis.processingProgress);
    }

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

  const getStageLabel = (value: ProcessingStage | null) => {
    if (value === 'queued') return 'Queued';
    if (value === 'preparing') return 'Preparing file';
    if (value === 'transcribing') return 'Transcribing';
    if (value === 'summarizing') return 'Summarizing';
    if (value === 'moderating') return 'Moderating';
    if (value === 'done') return 'Complete';
    if (value === 'error') return 'Failed';
    return 'Waiting';
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
    setIsTranscribing(isProcessing);

    if (!isProcessing) {
      stopPolling();
      // Log success data when transcription completes
      if (nextStatus === 'success' && analysis.transcript) {
        const logData = {
          recordingId: recordingId,
          documentId: documentId,
          transcriptLength: transcriptText.length,
          hasTranscript: !!transcriptText,
          hasSummary: !!analysis.summary,
          status: nextStatus,
          timestamp: new Date().toISOString(),
          elapsedSeconds: elapsedSeconds,
        };
        console.log('[Transcription Success]', logData);
        console.log('[Transcript Data]', transcriptText.substring(0, 500) + (transcriptText.length > 500 ? '...' : ''));
      }
    } else {
      startElapsedTimer();
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
        if (!isProcessing) {
          stopPolling();
        }
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
        if (isProcessing) {
          startPolling();
        }
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

  const handleGenerateTranscript = async () => {
    // Allow manual status check even while transcribing
    if (isTranscribing && transcriptStatus === 'processing') {
      setIsCheckingStatus(true);
      try {
        const isProcessing = await fetchCurrentAnalysis();
        if (!isProcessing) {
          stopPolling();
        }
      } catch (err) {
        console.error("Failed to check status:", err);
      } finally {
        setIsCheckingStatus(false);
      }
      return;
    }

    if (isTranscribing || isCheckingStatus) return;

    const shouldRetry = canRetry;

    try {
      setTranscriptError(null);
      setProcessingError(null);
      setIsRetrying(shouldRetry);
      setIsTranscribing(true);
      startElapsedTimer();

      if (recordingId) {
        const result = await generateRecordingTranscript(recordingId, shouldRetry);
        const isProcessing = applyAnalysis(result);
        if (isProcessing) {
          startPolling();
        }
      } else if (documentId) {
        const result = await generateDocumentTranscript(documentId, shouldRetry);
        const isProcessing = applyAnalysis(result);
        if (isProcessing) {
          startPolling();
        }
      } else {
        // Placeholder flow until AI backend is connected.
        await new Promise((resolve) => setTimeout(resolve, 900));
        setTranscriptContent(transcriptSeedMessage);
        setSummaryContent("");
        setTranscriptStatus('success');
      }
    } catch (err) {
      console.error("Failed to generate transcript:", err);
      const message = err instanceof Error ? err.message : "Cannot generate transcript right now.";
      setTranscriptError(message);
    } finally {
      setIsTranscribing(false);
      setIsRetrying(false);
    }
  };

  const handleSummarize = async () => {
    if (!canSummarize || isSummarizing) return;

    try {
      setIsSummarizing(true);

      if (recordingId) {
        const result = await generateRecordingSummary(recordingId, !!summaryContent.trim());
        setTranscriptContent(result.transcript || transcriptContent);
        setSummaryContent(result.summary || "");
      } else if (documentId) {
        setSummaryContent("Document summary is not available yet.");
      } else {
        // Placeholder UI-only behavior. AI backend integration will replace this.
        setSummaryContent("AI summarization service is not connected yet. The button is enabled and ready for backend integration.");
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
            (isTranscribing && transcriptStatus !== 'processing') ||
            (!canRetry && (hasTranscript || hasSummary))
          }
          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            isCheckingStatus || (isTranscribing && transcriptStatus !== 'processing') || (!canRetry && (hasTranscript || hasSummary))
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-[#292C6D] text-white hover:bg-[#1f2350]"
          }`}
        >
          {isCheckingStatus ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Checking status...
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
          ) : transcriptContent ? (
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
            Processing error: {processingError}
          </p>
        )}

        <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
            <span>{getStageLabel(processingStage)}</span>
            <span>{processingProgress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-2 rounded-full transition-all ${processingProgress === 100 ? 'bg-emerald-500' : processingError ? 'bg-red-500' : 'bg-[#292C6D]'}`}
              style={{ width: `${normalizeProgress(processingProgress)}%` }}
            />
          </div>
        </div>

        {hasTranscript && !canRetry && (
          <p className="mt-2 text-xs font-medium text-emerald-700">Transcript already exists.</p>
        )}

        {transcriptStatus === 'processing' && !canRetry && (
          <p className="mt-2 text-xs font-medium text-sky-700">
            ⏳ Transcript is being processed... (Running for {elapsedSeconds}s) You can leave this page and come back later. We'll continue processing in the background.
          </p>
        )}

        <div className="mt-3 h-52 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
          {isLoadingExisting && !transcriptContent
            ? "Loading saved transcript..."
            : (transcriptContent || transcriptEmptyText)}
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
          <p className="mt-2 text-xs font-medium text-amber-700">
            Generate transcript first.
          </p>
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
