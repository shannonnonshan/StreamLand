/**
 * Get student ID from localStorage or return 'guest' as fallback
 */
export const getStudentId = (): string => {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('userId');
    if (userId) return userId;
  }
  return 'guest';
};

/**
 * Get student route with proper ID
 */
export const getStudentRoute = (path: string): string => {
  const studentId = getStudentId();
  // Remove leading slash if exists
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `/student/${studentId}/${cleanPath}`;
};

/**
 * Check if user is logged in as student
 */
export const isStudentLoggedIn = (): boolean => {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role');
    return !!(userId && role === 'STUDENT');
  }
  return false;
};
