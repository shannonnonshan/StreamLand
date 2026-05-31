"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock3,
  FileAudio2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import socket from "@/socket";
import {
  getProcessingStatus,
  retryProcessing,
  type ProcessingEntityType,
  type ProcessingStatusResponse,
  type ProcessingStep,
  type ProcessingStepState,
  type ProcessingStepStatus,
} from "@/lib/api/processing";

const STEP_META: Record<ProcessingStep, { label: string; description: string; icon: typeof FileAudio2 }> = {
  EXTRACT_AUDIO: {
    label: 'Extract Audio',
    description: 'We prepare the video sound so the system can read it clearly.',
    icon: FileAudio2,
  },
  UPLOAD_AUDIO: {
    label: 'Upload Audio',
    description: 'The prepared sound is safely uploaded for the next step.',
    icon: Upload,
  },
  TRANSCRIBE: {
    label: 'Transcribe',
    description: 'We turn what is spoken into written text.',
    icon: Sparkles,
  },
  SUMMARIZE: {
    label: 'Summarize',
    description: 'We create a short and easy-to-read summary.',
    icon: FileText,
  },
  MODERATION: {
    label: 'Moderation',
    description: 'We check the content to help keep it safe and appropriate.',
    icon: ShieldAlert,
  },
  SAVE_RESULTS: {
    label: 'Save Results',
    description: 'Your transcript and summary are saved and ready to use.',
    icon: Save,
  },
  COMPLETED: {
    label: 'Completed',
    description: 'Everything is finished and ready for review.',
    icon: BadgeCheck,
  },
};

const STEP_ORDER: ProcessingStep[] = [
  'EXTRACT_AUDIO',
  'UPLOAD_AUDIO',
  'TRANSCRIBE',
  'SUMMARIZE',
  'MODERATION',
  'SAVE_RESULTS',
  'COMPLETED',
];

interface ProcessingTrackerProps {
  entityId: string;
  entityType: ProcessingEntityType;
  showRetry?: boolean;
  autoRetryOnFailed?: boolean;
  onCompleted?: () => void;
  onFailed?: (step: string) => void;
  triggerClassName?: string;
  showInlineProgress?: boolean;
}

const normalizeApprovalState = (value: ProcessingStatusResponse['isApprove']) => {
  if (value === true) return 'approved';
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'TRUE') return 'approved';
    if (normalized === 'REJECTED') return 'rejected';
  }
  return 'pending';
};

const getStepIconState = (status: ProcessingStepStatus) => {
  if (status === 'running') return 'running';
  if (status === 'done') return 'done';
  if (status === 'failed') return 'failed';
  return 'pending';
};

const getStepMessage = (step: ProcessingStepState) => step.errorMessage ?? step.message ?? null;

const formatLastUpdated = (updatedAt: string | undefined, nowMs: number) => {
  if (!updatedAt) return null;
  const updatedMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedMs)) return null;
  const diffSeconds = Math.max(0, Math.floor((nowMs - updatedMs) / 1000));
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

// FIX 3: Đổi từ 15 phút xuống 10 phút theo yêu cầu
const TEN_MINUTES_MS = 10 * 60 * 1000;

export default function ProcessingTracker({
  entityId,
  entityType,
  showRetry = false,
  autoRetryOnFailed = false,
  onCompleted,
  onFailed,
  triggerClassName,
  showInlineProgress = false,
}: ProcessingTrackerProps) {
  const [status, setStatus] = useState<ProcessingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryingStep, setRetryingStep] = useState<ProcessingStep | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // FIX 3: Track thời điểm step hiện tại bắt đầu, không dùng updatedAt chung
  const [activeStepSinceMs, setActiveStepSinceMs] = useState<number | null>(null);
  const lastActiveStepRef = useRef<ProcessingStep | null>(null);

  // FIX 3: Cooldown sau khi retry – chờ 10 phút mới cho bấm lại
  const [retryCooldownUntil, setRetryCooldownUntil] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);
  const completedNotifiedRef = useRef(false);
  const failedNotifiedRef = useRef<string | null>(null);
  const stepRefs = useRef<Partial<Record<ProcessingStep, HTMLDivElement | null>>>({});
  const autoRetryFiredRef = useRef(false);
  const isRetrying = Boolean(retryingStep);
  const isSyncing = loading || isPolling || isRetrying;

  const statusSteps = status?.steps ?? [];
  const hasFailedStep = statusSteps.some((step) => step.status === 'failed');
  const approvalState = normalizeApprovalState(status?.isApprove ?? null);
  const isRejected = approvalState === 'rejected';
  const isWaitingForApproval = Boolean(status?.waitingForApproval);
  const isCompleted = Boolean(
    !isRejected &&
    status?.completed &&
    status?.processingStatus === 'DONE' &&
    !isWaitingForApproval
  );
  const isFailed = status?.processingStatus === 'FAILED';

  const activeStep = isRejected
    ? 'COMPLETED'
    : status?.activeStep
    || statusSteps.find((step) => step.status === 'running')?.step
    || statusSteps.find((step) => step.status === 'failed')?.step
    || statusSteps.find((step) => step.status === 'pending')?.step
    || null;

  const failedStepState = statusSteps.find((step) => step.step === status?.lastFailedStep)
    || statusSteps.find((step) => step.status === 'failed')
    || null;
  const failedStepMessage = failedStepState ? getStepMessage(failedStepState) : null;
  const failedStepLabel = failedStepState ? STEP_META[failedStepState.step]?.label ?? failedStepState.step : null;
  const retryFallbackStep = status?.lastFailedStep || activeStep || 'EXTRACT_AUDIO';

  // FIX 3: Stale = step hiện tại không đổi quá 10 phút VÀ không đang trong cooldown
  const isStaleProcessing = Boolean(
    status?.processingStatus === 'PROCESSING' &&
    activeStepSinceMs !== null &&
    (retryCooldownUntil === null || nowMs >= retryCooldownUntil) &&
    nowMs - activeStepSinceMs > TEN_MINUTES_MS
  );
  const staleElapsedMinutes = isStaleProcessing && activeStepSinceMs !== null
    ? Math.floor((nowMs - activeStepSinceMs) / 60000)
    : 0;

  // FIX 3: Cooldown còn lại (giây) để hiển thị cho user
  const retryCooldownRemainingSeconds = retryCooldownUntil !== null && nowMs < retryCooldownUntil
    ? Math.ceil((retryCooldownUntil - nowMs) / 1000)
    : 0;

  const showIdleRetryButton = Boolean(
    showRetry
    && status
    && !isRejected
    && !isWaitingForApproval
    && !isCompleted
    && status.processingStatus !== 'PROCESSING'
    && !hasFailedStep,
  );
  const showStaleRetryButton = Boolean(showRetry && isStaleProcessing && !isRejected);

  const triggerConfig = useMemo(() => {
    if (status?.processingStatus === 'PROCESSING') {
      return {
        label: 'Processing...',
        className: 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700',
        icon: Loader2,
      };
    }
    if (isRejected) {
      return {
        label: 'Rejected – View Details',
        className: 'bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700',
        icon: AlertTriangle,
      };
    }
    if (isWaitingForApproval) {
      return {
        label: 'Waiting for Approval',
        className: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600',
        icon: Clock3,
      };
    }
    if (isCompleted || approvalState === 'approved') {
      return {
        label: 'View Processing Result',
        className: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700',
        icon: BadgeCheck,
      };
    }
    if (isFailed) {
      return {
        label: 'Processing Failed – View Details',
        className: 'bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700',
        icon: AlertTriangle,
      };
    }
    return {
      label: 'View Processing Status',
      className: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50',
      icon: Clock3,
    };
  }, [approvalState, isCompleted, isFailed, isRejected, isWaitingForApproval, status?.processingStatus]);

  const triggerLabel = useMemo(() => {
    if (loading) return 'Loading status...';
    if (isRetrying) return 'Retrying...';
    if (isPolling && status?.processingStatus !== 'PROCESSING') return 'Syncing status...';
    return triggerConfig.label;
  }, [isPolling, isRetrying, loading, status?.processingStatus, triggerConfig.label]);

  // FIX 1: Bọc loadStatus trong useCallback để tránh stale closure trong setInterval
  const loadStatus = useCallback(async () => {
    const controller = new AbortController();
    if (statusAbortRef.current) {
      statusAbortRef.current.abort();
    }
    statusAbortRef.current = controller;

    try {
      const nextStatus = await getProcessingStatus(entityType, entityId, { signal: controller.signal });
      setStatus(nextStatus);
      setError(null);
      return nextStatus;
    } catch (loadError) {
      if (controller.signal.aborted || (loadError instanceof Error && loadError.name === 'AbortError')) {
        return null;
      }
      const message = loadError instanceof Error ? loadError.message : 'Failed to load processing status';
      setError(message);
      return null;
    } finally {
      if (statusAbortRef.current === controller) {
        statusAbortRef.current = null;
      }
      setLoading(false);
    }
  }, [entityId, entityType]);

  // FIX 1: startPolling dùng ref để luôn gọi phiên bản mới nhất của loadStatus
  const loadStatusRef = useRef(loadStatus);
  useEffect(() => {
    loadStatusRef.current = loadStatus;
  }, [loadStatus]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setIsPolling(true);
    pollRef.current = setInterval(() => {
      // Gọi qua ref → luôn dùng loadStatus mới nhất, không bị stale closure
      void loadStatusRef.current();
    }, 3000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (statusAbortRef.current) {
      statusAbortRef.current.abort();
      statusAbortRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    // Reset transient loading state when switching to a different entity
    setLoading(true);
    setError(null);
    setRetryingStep(null);
    setRetryCooldownUntil(null);
    setActiveStepSinceMs(null);
    lastActiveStepRef.current = null;
    autoRetryFiredRef.current = false;
    completedNotifiedRef.current = false;
    failedNotifiedRef.current = null;

    void loadStatus();

    // FIX 2: Join room để server biết client đang track entity nào
    // Server cần lắng nghe event 'join-processing-room' và đưa socket vào room tương ứng
    socket.emit('join-processing-room', { entityId, entityType });

    const handleStepUpdate = (payload: {
      entityId: string;
      entityType: ProcessingEntityType;
      step: ProcessingStep;
      status: ProcessingStepStatus;
      message?: string;
      timestamp: string;
    }) => {
      if (payload.entityId !== entityId || payload.entityType !== entityType) return;
      void loadStatus();
    };

    const handleConnect = () => {
      stopPolling();
      // Re-join room sau khi reconnect
      socket.emit('join-processing-room', { entityId, entityType });
      void loadStatus();
    };

    const handleDisconnect = () => {
      startPolling();
    };

    socket.on('processing-step-update', handleStepUpdate);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);

    if (!socket.connected) {
      socket.connect();
      startPolling();
    }

    return () => {
      socket.off('processing-step-update', handleStepUpdate);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      // FIX 2: Leave room khi unmount
      socket.emit('leave-processing-room', { entityId, entityType });
      stopPolling();
    };
  }, [entityId, entityType, loadStatus, startPolling, stopPolling]);

  // FIX 3: Theo dõi khi nào activeStep thay đổi để reset đồng hồ 10 phút
  useEffect(() => {
    if (!activeStep) return;
    if (activeStep !== lastActiveStepRef.current) {
      // Step mới → reset timer
      lastActiveStepRef.current = activeStep;
      setActiveStepSinceMs(Date.now());
    }
  }, [activeStep]);

  useEffect(() => {
    if (!isOpen || !activeStep) return;
    const currentRef = stepRefs.current[activeStep];
    currentRef?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeStep, isOpen]);

  // Auto-retry khi FAILED, chỉ fire 1 lần per entityId+entityType
  useEffect(() => {
    if (!showRetry || !autoRetryOnFailed) return;
    if (!isFailed) {
      autoRetryFiredRef.current = false;
      return;
    }
    if (autoRetryFiredRef.current) return;
    if (retryingStep) return;
    autoRetryFiredRef.current = true;

    const step = (status?.lastFailedStep || status?.activeStep || 'EXTRACT_AUDIO') as ProcessingStep;

    // Bypass cooldown cho auto-retry – cooldown chỉ áp dụng cho manual retry
    stopPolling();
    setRetryingStep(step);
    setError(null);
    retryProcessing(entityType, entityId)
      .then((nextStatus) => {
        const retryStartedAt = Date.now();
        setRetryCooldownUntil(retryStartedAt + TEN_MINUTES_MS);
        setActiveStepSinceMs(retryStartedAt);
        lastActiveStepRef.current = step;
        setStatus({
          ...nextStatus,
          processingStatus: 'PROCESSING',
          activeStep: nextStatus.activeStep || step,
          updatedAt: new Date(retryStartedAt).toISOString(),
        });
        setIsOpen(true);
        startPolling();
      })
      .catch((err) => {
        console.error('Auto-retry failed:', err);
        setError(err instanceof Error ? err.message : 'Auto-retry failed');
        autoRetryFiredRef.current = false; // cho phép thử lại nếu lỗi
      })
      .finally(() => {
        setRetryingStep(null);
      });
  }, [isFailed, showRetry, autoRetryOnFailed, entityId, entityType]);

  useEffect(() => {
    if (!status) return;

    if (isCompleted && !completedNotifiedRef.current) {
      completedNotifiedRef.current = true;
      onCompleted?.();
    }
    if (!isCompleted) {
      completedNotifiedRef.current = false;
    }

    const failedStep =
      status.lastFailedStep ||
      status.steps?.find((step) => step.status === 'failed')?.step ||
      null;

    if (isFailed && failedStep && failedNotifiedRef.current !== failedStep) {
      failedNotifiedRef.current = failedStep;
      onFailed?.(failedStep);
    }
    if (!isFailed) {
      failedNotifiedRef.current = null;
    }
  }, [isCompleted, isFailed, onCompleted, onFailed, status]);

  const handleRetry = async (step: ProcessingStep) => {
    // FIX 3: Chặn retry nếu đang trong cooldown 10 phút
    if (retryingStep) return;
    if (retryCooldownUntil !== null && nowMs < retryCooldownUntil) return;

    try {
      stopPolling();
      setRetryingStep(step);
      setError(null);
      const nextStatus = await retryProcessing(entityType, entityId);
      const retryStartedAt = Date.now();

      // FIX 3: Set cooldown 10 phút kể từ lần retry này
      setRetryCooldownUntil(retryStartedAt + TEN_MINUTES_MS);

      // Reset đồng hồ step vì đang bắt đầu lại
      setActiveStepSinceMs(retryStartedAt);
      lastActiveStepRef.current = step;

      setStatus({
        ...nextStatus,
        processingStatus: 'PROCESSING',
        activeStep: nextStatus.activeStep || step,
        updatedAt: new Date(retryStartedAt).toISOString(),
      });
      setIsOpen(true);
      startPolling();
    } catch (retryError) {
      console.error('Failed to retry processing:', retryError);
      setError(retryError instanceof Error ? retryError.message : 'Failed to retry processing');
    } finally {
      setRetryingStep(null);
    }
  };

  const steps = statusSteps.length
    ? STEP_ORDER.map((step) => {
        const current = statusSteps.find((entry) => entry.step === step);
        const fallbackStep = current || {
          step,
          status: 'pending' as ProcessingStepStatus,
          message: null,
          timestamp: new Date().toISOString(),
        };

        if (isRejected) {
          return {
            ...fallbackStep,
            status: step === 'COMPLETED'
              ? ('failed' as ProcessingStepStatus)
              : ('done' as ProcessingStepStatus),
            message: step === 'COMPLETED'
              ? (status?.rejectReason ?? 'This content was rejected.')
              : (fallbackStep.message ?? null),
          };
        }
        return fallbackStep;
      })
    : STEP_ORDER.map((step) => ({
        step,
        status: isRejected
          ? step === 'COMPLETED'
            ? ('failed' as ProcessingStepStatus)
            : ('done' as ProcessingStepStatus)
          : ('pending' as ProcessingStepStatus),
        message: isRejected && step === 'COMPLETED'
          ? (status?.rejectReason ?? 'This content was rejected.')
          : null,
        timestamp: new Date().toISOString(),
      }));

  const TriggerIcon = triggerConfig.icon;
  const doneStepsCount = statusSteps.filter((step) => step.status === 'done').length;
  const runningStep = statusSteps.find((step) => step.status === 'running');
  const runningStepLabel = runningStep ? STEP_META[runningStep.step].label : null;
  const lastUpdatedLabel = formatLastUpdated(status?.updatedAt, nowMs);

  const statusNotice = (() => {
    const retryButton = (label: string, step: ProcessingStep) => (
      <button
        type="button"
        onClick={() => void handleRetry(step)}
        disabled={Boolean(retryingStep) || retryCooldownRemainingSeconds > 0}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {retryingStep ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        {retryingStep
          ? 'Retrying...'
          : retryCooldownRemainingSeconds > 0
            ? `Wait ${Math.ceil(retryCooldownRemainingSeconds / 60)}m before retrying`
            : label}
      </button>
    );

    if (isRejected) {
      return {
        className: 'border-rose-200 bg-rose-50 text-rose-800',
        title: 'This content was rejected.',
        body: status?.rejectReason ? `Reason: ${status.rejectReason}` : 'The process has been terminated.',
      };
    }

    if (isFailed) {
      return {
        className: 'border-rose-200 bg-rose-50 text-rose-800',
        title: `Processing failed${failedStepLabel ? ` at ${failedStepLabel}` : ''}.`,
        body: failedStepMessage ?? 'Review the failed step below and retry if needed.',
        action: showRetry ? retryButton('Retry processing', retryFallbackStep) : null,
      };
    }

    if (isWaitingForApproval) {
      return {
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        body: 'Waiting for approval. Processing results are complete, but final approval is still pending.',
      };
    }

    if (isStaleProcessing) {
      return {
        className: 'border-amber-300 bg-amber-50 text-amber-900',
        title: `No progress for about ${staleElapsedMinutes} minutes.`,
        body: 'This process may be stuck. Retry will cancel the current pipeline and start again from the last safe step.',
        action: showRetry ? retryButton('Retry now', retryFallbackStep) : null,
      };
    }

    if (showIdleRetryButton) {
      return {
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        body: 'Processing is not running right now. You can retry to continue the pipeline.',
        action: retryButton('Retry processing', retryFallbackStep),
      };
    }

    if (isCompleted) {
      return {
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        body: 'Processing is complete and the content is ready for review.',
      };
    }

    if (status?.processingStatus === 'PROCESSING') {
      return {
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        body: `Processing is still running${runningStepLabel ? ` at ${runningStepLabel}` : ''}. You can keep this window open to follow each step in real time.`,
      };
    }

    return null;
  })();

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const progressPercent = useMemo(() => {
    if (!status) return 0;
    if (isRejected) return 100;
    if (status.processingStatus === 'DONE' && !status.waitingForApproval) return 100;
    const totalSteps = STEP_ORDER.length;
    const runningWeight = runningStep ? 0.5 : 0;
    const raw = ((doneStepsCount + runningWeight) / totalSteps) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [doneStepsCount, isRejected, runningStep, status]);

  return (
    <>
      <div className={showInlineProgress ? 'min-w-60' : ''}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${triggerClassName || triggerConfig.className}`}
        >
          <TriggerIcon size={16} className={isSyncing || status?.processingStatus === 'PROCESSING' ? 'animate-spin' : ''} />
          {triggerLabel}
        </button>

        {showInlineProgress && (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>{runningStep ? STEP_META[runningStep.step].label : 'Progress'}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-2 rounded-full transition-all ${
                  isRejected || status?.processingStatus === 'FAILED'
                    ? 'bg-rose-500'
                    : progressPercent >= 100
                      ? 'bg-emerald-500'
                      : 'bg-[#292C6D]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4 bg-[#121826] px-6 py-5 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/55">Processing Tracker</p>
                <h2 className="mt-1 text-2xl font-bold">{status?.title || 'Processing Progress'}</h2>
                <p className="mt-1 text-sm text-white/70">
                  {entityType === 'LIVESTREAM' ? 'Livestream recording' : 'Document'} · {entityId}
                </p>
                {lastUpdatedLabel && (
                  <p className="mt-1 text-xs font-medium text-white/60">Last updated {lastUpdatedLabel}</p>
                )}
                {status?.processingStatus === 'PROCESSING' && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                    Processing is running now
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20"
                aria-label="Close processing tracker"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
              {error && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {statusNotice && (
                <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${statusNotice.className}`}>
                  {statusNotice.title && <p className="font-semibold">{statusNotice.title}</p>}
                  {statusNotice.body && <p className={statusNotice.title ? 'mt-1' : ''}>{statusNotice.body}</p>}
                  {statusNotice.action}
                </div>
              )}

              <div className="space-y-3">
                {steps.map((step) => {
                  const meta = STEP_META[step.step];
                  const iconState = getStepIconState(step.status);
                  const Icon = meta.icon;
                  const isActive = activeStep === step.step;
                  const isFailedStep = step.status === 'failed';
                  const isRunning = step.status === 'running';
                  const stepMessage = getStepMessage(step);

                  return (
                    <div
                      key={step.step}
                      ref={(node) => {
                        stepRefs.current[step.step] = node;
                      }}
                      className={`rounded-3xl border p-4 transition ${
                        isFailedStep
                          ? 'border-rose-200 bg-rose-50/50 ring-1 ring-rose-200'
                          : isActive
                            ? 'border-[#121826]/20 bg-white shadow-sm'
                            : 'border-slate-200 bg-white/80'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            iconState === 'done'
                              ? 'bg-emerald-100 text-emerald-700'
                              : iconState === 'running'
                                ? 'bg-amber-100 text-amber-700'
                                : iconState === 'failed'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {iconState === 'done' ? (
                            <Check size={20} />
                          ) : iconState === 'running' ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : iconState === 'failed' ? (
                            <X size={20} />
                          ) : (
                            <Icon size={20} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">{meta.label}</h3>
                              <p className="mt-0.5 text-sm text-slate-500">{meta.description}</p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                iconState === 'done'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : iconState === 'running'
                                    ? 'bg-amber-100 text-amber-700'
                                    : iconState === 'failed'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>

                          {stepMessage && (
                            <p className={`mt-2 text-sm ${isFailedStep ? 'text-rose-700' : isRunning ? 'text-amber-700' : 'text-slate-600'}`}>
                              {stepMessage}
                            </p>
                          )}

                          {showRetry && isFailedStep && !isRejected && (
                            <button
                              type="button"
                              onClick={() => void handleRetry(step.step)}
                              disabled={Boolean(retryingStep) || retryCooldownRemainingSeconds > 0}
                              className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {retryingStep === step.step ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <RefreshCw size={16} />
                              )}
                              {retryingStep === step.step
                                ? 'Retrying...'
                                : retryCooldownRemainingSeconds > 0
                                  ? `Wait ${Math.ceil(retryCooldownRemainingSeconds / 60)}m`
                                  : 'Retry from this step'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}