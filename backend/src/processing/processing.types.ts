export const PROCESSING_QUEUE_NAME = 'processing';
export const PROCESSING_JOB_NAME = 'process';

export type ProcessingItemType = 'livestream' | 'document';

export interface ProcessingJobPayload {
  type: ProcessingItemType;
  itemId: string;
  fileUrl: string;
  title: string;
}

export type ProcessingJobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';