export const PROCESSING_QUEUE_NAME = 'processing';
export const PROCESSING_JOB_NAME = 'process';

export type ProcessingItemType = 'livestream' | 'document';

export type ProcessingStage = 'queued' | 'preparing' | 'transcribing' | 'summarizing' | 'moderating' | 'done' | 'error';

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