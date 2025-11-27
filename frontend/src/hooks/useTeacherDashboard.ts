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
        
        console.log('Dashboard fetch - teacherId:', teacherId, 'hasToken:', !!token);
        
        if (!teacherId) {
          throw new Error('Teacher ID not found');
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        console.log('Fetching from:', `${API_URL}/teacher/${teacherId}/dashboard/stats`);
        
        const response = await fetch(`${API_URL}/teacher/${teacherId}/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Token expired or invalid - clear auth and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            throw new Error('Session expired - Please login again');
          }
          
          const errorText = await response.text();
          console.error('API Error:', response.status, errorText);
          throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
        }

        const data = await response.json();
        console.log('Dashboard stats received:', data);
        setStats(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Dashboard stats error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}
