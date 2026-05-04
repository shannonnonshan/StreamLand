import { authenticatedFetch } from './fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface DocumentAiAnalysis {
  documentId: string;
  transcript: string | null;
  summary?: string | null;
  audioUrl?: string | null;
  transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
  transcriptError?: string | null;
  transcriptGeneratedAt?: string | null;
  summaryGeneratedAt?: string | null;
  cached?: boolean;
}

export async function getDocumentAiAnalysis(documentId: string): Promise<DocumentAiAnalysis> {
  return authenticatedFetch(`${API_URL}/documents/${documentId}/ai-analysis`);
}

export async function generateDocumentTranscript(documentId: string, force = false): Promise<DocumentAiAnalysis> {
  return authenticatedFetch(`${API_URL}/documents/${documentId}/transcript`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}
