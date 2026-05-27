const AUTH_KEYS = [
  'accessToken',
  'refreshToken',
  'user',
  'userId',
  'role',
  'token',
] as const;

const WATCH_PROGRESS_PREFIX = 'streamland:video-progress:';
export const AUTH_STATE_CHANGED_EVENT = 'streamland:auth-state-changed';

export const clearAuthStorage = () => {
  if (typeof window === 'undefined') return;
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const dispatchAuthStateChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
};

export const clearWatchProgressForUser = (userId?: string | null) => {
  if (typeof window === 'undefined' || !userId) return;

  const prefix = `${WATCH_PROGRESS_PREFIX}${userId}:`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }
};

export const clearAllWatchProgressCache = () => {
  if (typeof window === 'undefined') return;

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(WATCH_PROGRESS_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
};

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
};

export const getStoredUser = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user');
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload?.exp) return true;
    const expiryTime = payload.exp * 1000;
    return Date.now() >= expiryTime;
  } catch {
    return true;
  }
};
