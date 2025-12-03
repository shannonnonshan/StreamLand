const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface SavedDocument {
  id: string;
  documentId: string;
  studentId: string;
  savedAt: string;
  notes?: string;
  tags?: string[];
  isPinned: boolean;
  document: {
    id: string;
    teacherId: string;
    title: string;
    description?: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    mimeType: string;
    thumbnail?: string;
    uploadedAt: string;
    teacher: {
      id: string;
      fullName: string;
      avatar?: string;
    };
  };
}

// Helper to get auth token
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || localStorage.getItem('accessToken');
}

// Helper for authenticated fetch
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  if (!token) {
    console.error('No auth token found in localStorage');
    throw new Error('Authentication required');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge with any additional headers from options
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') headers[key] = value;
    });
  }

  console.log('Making authenticated request:', { url, hasToken: !!token });

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    console.error('API request failed:', response.status, response.statusText);
    const errorText = await response.text();
    console.error('Error details:', errorText);
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============ STUDENT DOCUMENTS API ============

// TEMPORARY MOCK DATA - Replace with real API when backend is ready
const MOCK_DOCUMENTS: SavedDocument[] = [
  {
    id: '1',
    documentId: 'doc1',
    studentId: 'student1',
    savedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Important for exam',
    tags: ['Math', 'Chapter 5'],
    isPinned: true,
    document: {
      id: 'doc1',
      teacherId: 'teacher1',
      title: 'Linear Algebra - Chapter 5',
      description: 'Vector spaces and linear transformations',
      fileUrl: 'https://example.com/doc1.pdf',
      fileName: 'linear-algebra-ch5.pdf',
      fileType: 'application/pdf',
      fileSize: 2500000,
      mimeType: 'application/pdf',
      uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      teacher: {
        id: 'teacher1',
        fullName: 'Dr. John Smith',
        avatar: undefined,
      }
    }
  },
  {
    id: '2',
    documentId: 'doc2',
    studentId: 'student1',
    savedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Practice problems',
    tags: ['Physics', 'Important'],
    isPinned: false,
    document: {
      id: 'doc2',
      teacherId: 'teacher2',
      title: 'Quantum Mechanics Fundamentals',
      description: 'Introduction to quantum mechanics',
      fileUrl: 'https://example.com/doc2.pdf',
      fileName: 'quantum-mechanics.pdf',
      fileType: 'application/pdf',
      fileSize: 3200000,
      mimeType: 'application/pdf',
      uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      teacher: {
        id: 'teacher2',
        fullName: 'Prof. Sarah Johnson',
        avatar: undefined,
      }
    }
  }
];

// Get all saved documents for a student
export async function getSavedDocuments(fileType?: string): Promise<SavedDocument[]> {
  // MOCK: Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  let filtered = [...MOCK_DOCUMENTS];
  
  if (fileType) {
    filtered = filtered.filter(doc => doc.document.fileType.includes(fileType));
  }
  
  return filtered;
  
  /* UNCOMMENT WHEN BACKEND IS READY:
  const params = new URLSearchParams();
  if (fileType) params.append('fileType', fileType);
  
  const url = `${API_URL}/student/saved-documents${params.toString() ? '?' + params.toString() : ''}`;
  return authenticatedFetch(url);
  */
}

// Save a document (from livestream or teacher profile)
export async function saveDocument(documentId: string, notes?: string, tags?: string[]): Promise<SavedDocument> {
  // MOCK: Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const newDoc: SavedDocument = {
    id: Date.now().toString(),
    documentId,
    studentId: 'student1',
    savedAt: new Date().toISOString(),
    notes,
    tags,
    isPinned: false,
    document: MOCK_DOCUMENTS[0].document, // Mock document data
  };
  
  MOCK_DOCUMENTS.push(newDoc);
  return newDoc;
  
  /* UNCOMMENT WHEN BACKEND IS READY:
  return authenticatedFetch(`${API_URL}/student/saved-documents`, {
    method: 'POST',
    body: JSON.stringify({ documentId, notes, tags }),
  });
  */
}

// Remove saved document
export async function removeSavedDocument(savedDocumentId: string): Promise<void> {
  // MOCK: Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const index = MOCK_DOCUMENTS.findIndex(doc => doc.id === savedDocumentId);
  if (index > -1) {
    MOCK_DOCUMENTS.splice(index, 1);
  }
  
  /* UNCOMMENT WHEN BACKEND IS READY:
  await authenticatedFetch(`${API_URL}/student/saved-documents/${savedDocumentId}`, {
    method: 'DELETE',
  });
  */
}

// Update saved document (notes, tags, pin status)
export async function updateSavedDocument(
  savedDocumentId: string, 
  updates: { notes?: string; tags?: string[]; isPinned?: boolean }
): Promise<SavedDocument> {
  // MOCK: Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const docIndex = MOCK_DOCUMENTS.findIndex(doc => doc.id === savedDocumentId);
  if (docIndex > -1) {
    MOCK_DOCUMENTS[docIndex] = {
      ...MOCK_DOCUMENTS[docIndex],
      ...updates,
    };
    return MOCK_DOCUMENTS[docIndex];
  }
  
  throw new Error('Document not found');
  
  /* UNCOMMENT WHEN BACKEND IS READY:
  return authenticatedFetch(`${API_URL}/student/saved-documents/${savedDocumentId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  */
}

// Toggle pin status
export async function togglePinDocument(savedDocumentId: string): Promise<SavedDocument> {
  // MOCK: Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const docIndex = MOCK_DOCUMENTS.findIndex(doc => doc.id === savedDocumentId);
  if (docIndex > -1) {
    MOCK_DOCUMENTS[docIndex].isPinned = !MOCK_DOCUMENTS[docIndex].isPinned;
    return MOCK_DOCUMENTS[docIndex];
  }
  
  throw new Error('Document not found');
  
  /* UNCOMMENT WHEN BACKEND IS READY:
  return authenticatedFetch(`${API_URL}/student/saved-documents/${savedDocumentId}/toggle-pin`, {
    method: 'PATCH',
  });
  */
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
