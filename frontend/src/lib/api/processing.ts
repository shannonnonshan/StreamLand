import { authenticatedFetch } from './fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ProcessingEntityType = 'LIVESTREAM' | 'DOCUMENT';
export type ProcessingStep =
  | 'EXTRACT_AUDIO'
  | 'UPLOAD_AUDIO'
  | 'TRANSCRIBE'
  | 'SUMMARIZE'
  | 'MODERATION'
  | 'SAVE_RESULTS'
  | 'COMPLETED';

export type ProcessingStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface ProcessingStepState {
  step: ProcessingStep;
  status: ProcessingStepStatus;
  message?: string | null;
  timestamp: string;
}

export interface ProcessingStatusResponse {
  entityId: string;
  entityType: ProcessingEntityType;
  processingStatus: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  isApprove: string | boolean | null;
  steps?: ProcessingStepState[];
  activeStep: ProcessingStep | null;
  lastFailedStep: ProcessingStep | null;
  completed: boolean;
  waitingForApproval: boolean;
  updatedAt: string;
  title?: string | null;
  rejectReason?: string | null;
}

export async function getProcessingStatus(
  entityType: ProcessingEntityType,
  entityId: string,
): Promise<ProcessingStatusResponse> {
  return authenticatedFetch(`${API_URL}/processing/${entityType}/${entityId}/status`);
}

export async function retryProcessing(
  entityType: ProcessingEntityType,
  entityId: string,
): Promise<ProcessingStatusResponse> {
  return authenticatedFetch(`${API_URL}/processing/${entityType}/${entityId}/retry`, {
    method: 'POST',
  });
}

export async function retryProcessingModeration(
  entityType: ProcessingEntityType,
  entityId: string,
): Promise<unknown> {
  return authenticatedFetch(`${API_URL}/processing/${entityType}/${entityId}/retry-moderation`, {
    method: 'POST',
  });
}