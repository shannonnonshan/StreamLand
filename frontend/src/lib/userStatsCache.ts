import { getStoredToken } from '@/lib/authStorage';

type UserStats = {
  streak: number;
};

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

const cache = new Map<string, { value: UserStats | null; fetchedAt: number }>();

export async function getUserStats(userId: string): Promise<UserStats | null> {
  if (!userId) return null;
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const token = getStoredToken();
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const resp = await fetch(`${API_URL}/student/stats/${encodeURIComponent(userId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) {
      cache.set(userId, { value: null, fetchedAt: now });
      return null;
    }
    const data = await resp.json();
    const result: UserStats = { streak: Number(data?.streak || 0) };
    cache.set(userId, { value: result, fetchedAt: now });
    return result;
  } catch (err) {
    cache.set(userId, { value: null, fetchedAt: now });
    return null;
  }
}

export function clearUserStatsCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}
