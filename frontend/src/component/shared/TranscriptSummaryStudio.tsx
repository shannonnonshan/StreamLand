"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp, FileText, GraduationCap, Loader2, Sparkles } from "lucide-react";
import {
  generateRecordingSummary,
  generateRecordingTranscript,
  getRecordingAiAnalysis,
} from "@/lib/api/teacher";
import {
  generateDocumentTranscript,
  getDocumentAiAnalysis,
} from "@/lib/api/document";

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
  const [transcriptStatus, setTranscriptStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDocumentMode = !!documentId && !recordingId;
  const canSummarize = !isDocumentMode && transcriptContent.trim().length > 0;

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
    transcript?: string | null;
    summary?: string | null;
    transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
    transcriptError?: string | null;
  }) => {
    setTranscriptContent(analysis.transcript || "");
    setSummaryContent(analysis.summary || "");

    const nextStatus = analysis.transcriptStatus || (analysis.transcript ? 'success' : 'idle');
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
          transcriptLength: analysis.transcript.length,
          hasTranscript: !!analysis.transcript,
          hasSummary: !!analysis.summary,
          status: nextStatus,
          timestamp: new Date().toISOString(),
          elapsedSeconds: elapsedSeconds,
        };
        console.log('[Transcription Success]', logData);
        console.log('[Transcript Data]', analysis.transcript.substring(0, 500) + (analysis.transcript.length > 500 ? '...' : ''));
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

    try {
      setTranscriptError(null);
      setIsTranscribing(true);
      startElapsedTimer();

      if (recordingId) {
        const result = await generateRecordingTranscript(recordingId, transcriptContent.trim().length > 0);
        const isProcessing = applyAnalysis(result);
        if (isProcessing) {
          startPolling();
        }
      } else if (documentId) {
        const result = await generateDocumentTranscript(documentId, transcriptContent.trim().length > 0);
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
          disabled={isCheckingStatus || (isTranscribing && transcriptStatus !== 'processing')}
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
          ) : isTranscribing && transcriptStatus === 'processing' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Click to refresh ({elapsedSeconds}s)
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

        {transcriptStatus === 'processing' && (
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
          disabled={!canSummarize || isSummarizing || isTranscribing}
          className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
            canSummarize
              ? "bg-[#292C6D] text-white hover:bg-[#1f2350]"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}
        >
          {isSummarizing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Summarize
        </button>

        {!canSummarize && !isDocumentMode && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Generate transcript first.
          </p>
        )}

        {isDocumentMode && (
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
