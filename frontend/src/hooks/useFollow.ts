'use client';

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useFollow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow a teacher
  const followTeacher = useCallback(async (teacherId: string) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_URL}/student/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ teacherId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to follow teacher');
      }

      setLoading(false);
      return { success: true, data: result };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Unfollow a teacher
  const unfollowTeacher = useCallback(async (teacherId: string) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_URL}/student/unfollow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ teacherId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to unfollow teacher');
      }

      setLoading(false);
      return { success: true, data: result };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Get followed teachers
  const getFollowedTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_URL}/student/followed-teachers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to get followed teachers');
      }

      setLoading(false);
      return { success: true, data: result };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Check if following a teacher
  const isFollowingTeacher = useCallback(async (teacherId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        return { isFollowing: false };
      }

      const response = await fetch(`${API_URL}/student/is-following/${teacherId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        return { isFollowing: false };
      }

      return result;
    } catch {
      return { isFollowing: false };
    }
  }, []);

  return {
    loading,
    error,
    followTeacher,
    unfollowTeacher,
    getFollowedTeachers,
    isFollowingTeacher,
  };
}
