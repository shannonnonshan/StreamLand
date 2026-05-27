export const PROCESSING_QUEUE_NAME = 'processing';
export const PROCESSING_JOB_NAME = 'process';

export type ProcessingItemType = 'livestream' | 'document';

export type ProcessingEntityType = 'LIVESTREAM' | 'DOCUMENT';

export type ProcessingStage = 'queued' | 'preparing' | 'transcribing' | 'summarizing' | 'moderating' | 'done' | 'error';

export type ProcessingStep =
  | 'EXTRACT_AUDIO'
  | 'UPLOAD_AUDIO'
  | 'TRANSCRIBE'
  | 'SUMMARIZE'
  | 'MODERATION'
  | 'SAVE_RESULTS'
  | 'COMPLETED';

export type ProcessingStepStatus = 'pending' | 'running' | 'done' | 'failed';

export const PROCESSING_STEPS: ProcessingStep[] = [
  'EXTRACT_AUDIO',
  'UPLOAD_AUDIO',
  'TRANSCRIBE',
  'SUMMARIZE',
  'MODERATION',
  'SAVE_RESULTS',
  'COMPLETED',
];

export const PROCESSING_STAGE_PROGRESS: Record<ProcessingStage, number> = {
  queued: 0,
  preparing: 10,
  transcribing: 35,
  summarizing: 60,
  moderating: 85,
  done: 100,
  error: 0,
};

export interface ProcessingJobPayload {
  type: ProcessingItemType;
  itemId: string;
  fileUrl: string;
  title: string;
}

export type ProcessingJobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface ProcessingAnalysisState {
  processingStage?: ProcessingStage;
  processingProgress?: number;
  processingError?: string | null;
}

export interface ProcessingStepState {
  step: ProcessingStep;
  status: ProcessingStepStatus;
  message?: string | null;
  timestamp: string;
}

export interface ProcessingStepUpdatePayload {
  entityId: string;
  entityType: ProcessingEntityType;
  step: ProcessingStep;
  status: ProcessingStepStatus;
  message?: string;
  timestamp: string;
}

export interface ProcessingStatusResponse {
  entityId: string;
  entityType: ProcessingEntityType;
  processingStatus: ProcessingJobStatus;
  isApprove: string | boolean | null;
  steps?: ProcessingStepState[];
  activeStep: ProcessingStep | null;
  lastFailedStep: ProcessingStep | null;
  completed: boolean;
  waitingForApproval: boolean;
  updatedAt: string;
  title?: string | null;
}