const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Document {
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
  updatedAt: string;
}

export interface Schedule {
  id: string;
  teacherId: string;
  title: string;
  startTime: string; // ISO timestamp
  endTime: string;   // ISO timestamp
  livestreamId?: string;
  isPublic: boolean;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  color?: string;
  location?: string;
  tags?: string[];
  notifyBefore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveStream {
  id: string;
  teacherId: string;
  title: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  recordingUrl?: string;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  currentViewers: number;
  totalViews: number;
  peakViewers: number;
  duration: number;
  isRecorded: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
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
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============ DOCUMENTS API ============

export async function getTeacherDocuments(teacherId: string, fileType?: string): Promise<Document[]> {
  const params = new URLSearchParams();
  if (fileType) params.append('fileType', fileType);
  
  const url = `${API_URL}/teacher/${teacherId}/documents${params.toString() ? '?' + params.toString() : ''}`;
  return authenticatedFetch(url);
}

export async function uploadDocument(teacherId: string, file: File): Promise<Document> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/teacher/${teacherId}/upload-document`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function deleteDocument(teacherId: string, documentId: string): Promise<void> {
  await authenticatedFetch(`${API_URL}/teacher/${teacherId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}

// ============ SCHEDULES API ============

export async function getTeacherSchedules(
  teacherId: string, 
  startDate?: string, 
  endDate?: string
): Promise<Schedule[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_URL}/livestream/schedule/teacher/${teacherId}${params.toString() ? '?' + params.toString() : ''}`;
  return authenticatedFetch(url);
}

export async function createSchedule(teacherId: string, data: {
  title: string;
  startTime: string;
  endTime: string;
  isPublic?: boolean;
  color?: string;
  location?: string;
  tags?: string[];
  notifyBefore?: number;
  category?: string;
}): Promise<Schedule> {
  return authenticatedFetch(`${API_URL}/livestream/schedule`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      teacherId,
    }),
  });
}

export async function updateSchedule(scheduleId: string, data: Partial<Schedule>): Promise<Schedule> {
  return authenticatedFetch(`${API_URL}/livestream/schedule/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  await authenticatedFetch(`${API_URL}/livestream/schedule/${scheduleId}`, {
    method: 'DELETE',
  });
}

// ============ LIVESTREAMS/RECORDINGS API ============

export async function getTeacherLivestreams(
  teacherId: string,
  status?: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
): Promise<LiveStream[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  
  const url = `${API_URL}/livestream/teacher/${teacherId}${params.toString() ? '?' + params.toString() : ''}`;
  return authenticatedFetch(url);
}

export async function getRecordedLivestreams(teacherId: string): Promise<LiveStream[]> {
  // Get all ENDED livestreams (with or without recordingUrl)
  // Detail page will show "No Recording Available" if recordingUrl is missing
  const url = `${API_URL}/livestream/teacher/${teacherId}/ended?limit=50`;
  return authenticatedFetch(url);
}

export async function getLivestreamById(livestreamId: string): Promise<LiveStream> {
  return authenticatedFetch(`${API_URL}/livestream/${livestreamId}`);
}

export async function startLivestreamEarly(livestreamId: string, title: string, category?: string): Promise<LiveStream> {
  return authenticatedFetch(`${API_URL}/livestream/${livestreamId}/start-early`, {
    method: 'POST',
    body: JSON.stringify({ title, category }),
  });
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

export function formatScheduleForCalendar(schedule: Schedule & { liveStream?: { description?: string; id?: string } }): {
  id: string;
  teacherId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  color: string;
  audience: 'public' | 'subscribers';
  notification?: number;
  description?: string;
  livestreamId?: string;
} {
  const startDate = new Date(schedule.startTime);
  const endDate = new Date(schedule.endTime);
  
  // Format date in local timezone (YYYY-MM-DD)
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  // Format time in local timezone (HH:mm)
  const startHour = String(startDate.getHours()).padStart(2, '0');
  const startMin = String(startDate.getMinutes()).padStart(2, '0');
  const endHour = String(endDate.getHours()).padStart(2, '0');
  const endMin = String(endDate.getMinutes()).padStart(2, '0');
  
  return {
    id: schedule.id,
    teacherId: schedule.teacherId,
    title: schedule.title,
    date: dateStr,
    start: `${startHour}:${startMin}`,
    end: `${endHour}:${endMin}`,
    color: schedule.color || 'blue',
    audience: schedule.isPublic ? 'public' : 'subscribers' as 'public' | 'subscribers',
    notification: schedule.notifyBefore,
    description: schedule.liveStream?.description || '',
    livestreamId: schedule.livestreamId || schedule.liveStream?.id,
  };
}

export function groupRecordingsByMonth(recordings: LiveStream[]) {
  const grouped: Record<string, LiveStream[]> = {};
  
  recordings.forEach(recording => {
    const date = new Date(recording.endedAt || recording.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(recording);
  });
  
  return grouped;
}

// Format livestream as calendar event
export function formatLivestreamForCalendar(livestream: LiveStream, type: 'scheduled' | 'live' | 'ended'): {
  id: string;
  teacherId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  color: string;
  audience: 'public' | 'subscribers';
  description?: string;
  livestreamId: string;
  type: 'livestream';
  status: string;
} {
  // Determine which timestamp to use
  let startDate: Date;
  let endDate: Date;
  
  if (type === 'scheduled') {
    startDate = new Date(livestream.scheduledAt || livestream.createdAt);
    // Default 1 hour duration for scheduled
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  } else if (type === 'live') {
    startDate = new Date(livestream.startedAt || livestream.createdAt);
    // Default 1 hour from start or until now
    endDate = new Date();
  } else {
    // ended
    startDate = new Date(livestream.startedAt || livestream.createdAt);
    endDate = new Date(livestream.endedAt || new Date());
  }
  
  // Format date in local timezone (YYYY-MM-DD)
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  // Format time in local timezone (HH:mm)
  const startHour = String(startDate.getHours()).padStart(2, '0');
  const startMin = String(startDate.getMinutes()).padStart(2, '0');
  const endHour = String(endDate.getHours()).padStart(2, '0');
  const endMin = String(endDate.getMinutes()).padStart(2, '0');
  
  return {
    id: livestream.id,
    teacherId: livestream.teacherId,
    title: livestream.title,
    date: dateStr,
    start: `${startHour}:${startMin}`,
    end: `${endHour}:${endMin}`,
    color: type === 'scheduled' ? 'purple' : (type === 'live' ? 'red' : 'gray'),
    audience: livestream.isPublic ? 'public' : 'subscribers',
    description: livestream.description,
    livestreamId: livestream.id,
    type: 'livestream',
    status: type,
  };
}

// Update teacher profile (generic - works for bio, avatar, location, etc.)
export async function updateUserProfile(updateData: {
  bio?: string;
  avatar?: string;
  location?: string;
  fullName?: string;
}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_URL}/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    throw new Error('Failed to update profile');
  }

  return response.json();
}

// Update teacher-specific profile (education, experience, website, linkedin, subjects)
export async function updateTeacherProfile(updateData: {
  education?: string;
  experience?: number;
  website?: string;
  linkedin?: string;
  subjects?: string[];
  fullName?: string;
  bio?: string;
  location?: string;
}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_URL}/auth/profile/teacher`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    throw new Error('Failed to update teacher profile');
  }

  return response.json();
}
