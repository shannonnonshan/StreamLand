import { authenticatedFetch } from './fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface SavedDocument {
  id: string; // MongoDB ObjectId
  studentId: string;
  livestreamId: string;
  documentId: string;
  title: string;
  filename: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  notes: string;
  tags: string[];
  isPinned: boolean;
  folder: string;
  savedAt: Date;
  lastAccessedAt: Date;
}

// ============ STUDENT DOCUMENTS API ============

// Save a document from livestream
export async function saveDocument(data: {
  livestreamId: string;
  documentId: string;
  title: string;
  filename: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  folder?: string;
  tags?: string[];
}): Promise<SavedDocument> {
  return authenticatedFetch(`${API_URL}/student/documents/save`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get all saved documents
export async function getSavedDocuments(filters?: {
  folder?: string;
  isPinned?: boolean;
  tags?: string[];
}): Promise<SavedDocument[]> {
  const params = new URLSearchParams();
  
  if (filters?.folder) params.append('folder', filters.folder);
  if (filters?.isPinned !== undefined) params.append('isPinned', filters.isPinned.toString());
  if (filters?.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','));
  
  const url = `${API_URL}/student/documents/saved${params.toString() ? '?' + params.toString() : ''}`;
  return authenticatedFetch(url);
}

// Update saved document (notes, tags, pin status)
export async function updateSavedDocument(
  documentId: string, 
  updates: { 
    notes?: string; 
    tags?: string[]; 
    isPinned?: boolean;
    folder?: string;
  }
): Promise<SavedDocument> {
  return authenticatedFetch(`${API_URL}/student/documents/saved/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// Remove saved document
export async function removeSavedDocument(documentId: string): Promise<void> {
  await authenticatedFetch(`${API_URL}/student/documents/saved/${documentId}`, {
    method: 'DELETE',
  });
}

// Check if document is saved
export async function isDocumentSaved(livestreamId: string, documentId: string): Promise<{
  isSaved: boolean;
  document: SavedDocument | null;
}> {
  const params = new URLSearchParams({ livestreamId, documentId });
  return authenticatedFetch(`${API_URL}/student/documents/check?${params.toString()}`);
}

// Toggle pin status
export async function togglePinDocument(documentId: string, currentPinStatus: boolean): Promise<SavedDocument> {
  return updateSavedDocument(documentId, { isPinned: !currentPinStatus });
}

// Get documents from a specific livestream
export async function getLivestreamDocuments(livestreamId: string): Promise<any[]> {
  return authenticatedFetch(`${API_URL}/livestream/${livestreamId}/documents`);
}

// ============ UTILITY FUNCTIONS ============

export function mapDocumentTypeToFileType(docType: string): string | undefined {
  const mapping: Record<string, string> = {
    'file': 'pdf',
    'image': 'image',
    'video': 'video',
  };
  return mapping[docType.toLowerCase()];
}
