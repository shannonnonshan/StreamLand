const AUTH_KEYS = [
  'accessToken',
  'refreshToken',
  'user',
  'userId',
  'role',
  'token',
] as const;

export const clearAuthStorage = () => {
  if (typeof window === 'undefined') return;
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
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
