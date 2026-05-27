"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export default function ProcessingTracker({
  entityId,
  entityType,
  showRetry = false,
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedNotifiedRef = useRef(false);
  const failedNotifiedRef = useRef<string | null>(null);
  const stepRefs = useRef<Partial<Record<ProcessingStep, HTMLDivElement | null>>>({});
  const statusSteps = status?.steps ?? [];

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

  const loadStatus = async () => {
    try {
      const nextStatus = await getProcessingStatus(entityType, entityId);
      setStatus(nextStatus);
      console.log('isApprove raw:', nextStatus?.isApprove, '| normalized:', normalizeApprovalState(nextStatus?.isApprove ?? null));

      setError(null);
      return nextStatus;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load processing status';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    setIsPolling(true);
    pollRef.current = setInterval(() => {
      void loadStatus();
    }, 3000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  };

  useEffect(() => {
    completedNotifiedRef.current = false;
    failedNotifiedRef.current = null;

    void loadStatus();

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
      stopPolling();
    };
  }, [entityId, entityType]);

  useEffect(() => {
    if (!isOpen || !activeStep) return;
    const currentRef = stepRefs.current[activeStep];
    currentRef?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeStep, isOpen]);

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
    try {
      setRetryingStep(step);
      const nextStatus = await retryProcessing(entityType, entityId);
      setStatus(nextStatus);
      setIsOpen(true);
    } catch (retryError) {
      console.error('Failed to retry processing:', retryError);
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
          <TriggerIcon size={16} className={status?.processingStatus === 'PROCESSING' ? 'animate-spin' : ''} />
          {loading ? 'Loading status...' : triggerConfig.label}
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

              {isRejected && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  This content was rejected{status?.rejectReason ? `: ${status.rejectReason}` : '.'} The process has been terminated.
                </div>
              )}

              {!isRejected && isWaitingForApproval && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  Waiting for approval. Processing results are complete, but final approval is still pending.
                </div>
              )}

              {!isRejected && isCompleted && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Processing is complete and the content is ready for review.
                </div>
              )}

              {!isRejected && isFailed && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  Processing failed. Review the failed step below and retry if needed.
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

                  return (
                    <div
                      key={step.step}
                      ref={(node) => {
                        stepRefs.current[step.step] = node;
                      }}
                      className={`rounded-3xl border p-4 transition ${
                        isActive ? 'border-[#121826]/20 bg-white shadow-sm' : 'border-slate-200 bg-white/80'
                      } ${isFailedStep ? 'ring-1 ring-rose-200' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            iconState === 'done'
                              ? 'bg-emerald-100 text-emerald-700'
                              : iconState === 'running'
                                ? 'bg-blue-100 text-blue-700'
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
                                    ? 'bg-blue-100 text-blue-700'
                                    : iconState === 'failed'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>

                          {step.message && (
                            <p className={`mt-2 text-sm ${isFailedStep ? 'text-rose-700' : isRunning ? 'text-blue-700' : 'text-slate-600'}`}>
                              {step.message}
                            </p>
                          )}

                          {showRetry && isFailedStep && !isRejected && (
                            <button
                              type="button"
                              onClick={() => void handleRetry(step.step)}
                              disabled={retryingStep === step.step}
                              className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {retryingStep === step.step ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <RefreshCw size={16} />
                              )}
                              Retry from this step
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