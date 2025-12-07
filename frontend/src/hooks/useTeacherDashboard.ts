import { useState, useEffect } from 'react';

export interface TopLivestream {
  id: string;
  title: string;
  thumbnail: string | null;
  totalViews: number;
  peakViewers: number;
  endedAt: Date;
}

export interface DashboardStats {
  totalStudents: number;
  totalLivestreams: number;
  totalRecordings: number;
  totalViews: number;
  totalDocuments: number;
  scheduledLivestreams: number;
  avgViewsPerStream: number;
  totalWatchTimeHours: number;
  monthlyViews: number[];
  monthlySubscribers: number[];
  rating: number;
  topLivestreams: TopLivestream[];
}

// Simple in-memory cache
const dashboardCache = new Map<string, { data: DashboardStats; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useTeacherDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const userStr = localStorage.getItem('user');
        
        if (!token || !userStr) {
          throw new Error('Not authenticated - Please login again');
        }
        
        const user = JSON.parse(userStr);
        const teacherId = user.id;
        
        if (!teacherId) {
          throw new Error('Teacher ID not found');
        }

        // Check cache first
        const cacheKey = `dashboard_${teacherId}`;
        const cached = dashboardCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          console.log('Using cached dashboard stats');
          setStats(cached.data);
          setLoading(false);
          return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        // Use abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(`${API_URL}/teacher/${teacherId}/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            throw new Error('Session expired - Please login again');
          }
          
          throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
        }

        const data = await response.json();
        
        // Cache the result
        dashboardCache.set(cacheKey, { data, timestamp: Date.now() });
        
        setStats(data);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (errorMessage !== 'This operation was aborted') {
          setError(errorMessage);
        }
        console.error('Dashboard stats error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}
