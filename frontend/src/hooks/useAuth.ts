'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  avatar?: string;
  twoFactorEnabled?: boolean;
}

interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  role?: 'STUDENT' | 'TEACHER' | 'ADMIN';
}

interface LoginData {
  email: string;
  password: string;
}

interface VerifyOtpData {
  email: string;
  otp: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setUser, setIsAuthenticated } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh token every 14 minutes (before 15min expiry)
  useEffect(() => {
    const refreshAccessToken = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      const accessToken = localStorage.getItem('accessToken');
      
      // Only refresh if both tokens exist and user is authenticated
      if (!refreshToken || !accessToken || !isAuthenticated) {
        console.log('⏭️ Skipping auto-refresh: not authenticated or tokens missing');
        return;
      }

      console.log('🔄 Attempting to refresh token...');
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.ok) {
          const result = await response.json();
          localStorage.setItem('accessToken', result.accessToken);
          localStorage.setItem('refreshToken', result.refreshToken);
          console.log('✅ Token refreshed successfully');
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.error('❌ Failed to refresh token:', response.status, errorData);
          // If refresh fails, logout
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
          router.push('/');
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
      }
    };

    // Only set up auto-refresh if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    // Refresh token every 14 minutes (840000ms)
    const interval = setInterval(refreshAccessToken, 14 * 60 * 1000);

    // Don't refresh on mount - only on interval
    // This prevents issues with stale tokens on page reload

    return () => clearInterval(interval);
  }, [router, setUser, setIsAuthenticated, isAuthenticated]);


  // Register
  const register = useCallback(async (data: RegisterData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed');
      }

      setLoading(false);
      return { success: true, email: result.email, message: result.message };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Verify OTP
  const verifyOtp = useCallback(async (data: VerifyOtpData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify(data),
      });

      const result: AuthResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'OTP verification failed');
      }

      // Save tokens
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);

      // Fetch full profile to get complete data
      const profileResponse = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${result.accessToken}`,
        },
      });

      let finalUser = result.user;
      if (profileResponse.ok) {
        const fullProfile = await profileResponse.json();
        localStorage.setItem('user', JSON.stringify(fullProfile));
        setUser(fullProfile);
        finalUser = fullProfile;
      } else {
        localStorage.setItem('user', JSON.stringify(result.user));
        setUser(result.user);
      }

      setIsAuthenticated(true);
      setLoading(false);
      return { success: true, user: finalUser };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setUser, setIsAuthenticated]);

  // Verify 2FA OTP
  const verify2FAOtp = useCallback(async (data: VerifyOtpData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/verify-2fa-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: AuthResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || '2FA verification failed');
      }

      // Save tokens
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);

      // Fetch full profile to get complete data
      const profileResponse = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${result.accessToken}`,
        },
      });

      let finalUser = result.user;
      if (profileResponse.ok) {
        const fullProfile = await profileResponse.json();
        localStorage.setItem('user', JSON.stringify(fullProfile));
        setUser(fullProfile);
        finalUser = fullProfile;
      } else {
        localStorage.setItem('user', JSON.stringify(result.user));
        setUser(result.user);
      }

      setIsAuthenticated(true);
      setLoading(false);
      return { success: true, user: finalUser };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setUser, setIsAuthenticated]);

  // Login
  const login = useCallback(async (data: LoginData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json() as AuthResponse & { requires2FA?: boolean; email?: string };

      if (!response.ok) {
        throw new Error(result.message || 'Login failed');
      }

      // Check if 2FA is required
      if (result.requires2FA) {
        setLoading(false);
        return { 
          success: true, 
          requires2FA: true, 
          email: result.email!,
          message: result.message 
        };
      }

      // Normal login (no 2FA)
      // Save tokens
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);

      // Fetch full profile to get complete data including twoFactorEnabled
      const profileResponse = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${result.accessToken}`,
        },
      });

      let finalUser = result.user;
      if (profileResponse.ok) {
        const fullProfile = await profileResponse.json();
        localStorage.setItem('user', JSON.stringify(fullProfile));
        setUser(fullProfile);
        finalUser = fullProfile;
      } else {
        localStorage.setItem('user', JSON.stringify(result.user));
        setUser(result.user);
      }

      setIsAuthenticated(true);
      setLoading(false);

      return { success: true, user: finalUser };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setUser, setIsAuthenticated]);

  // Google Login
  const loginWithGoogle = useCallback((role?: 'STUDENT' | 'TEACHER') => {
    // Pass role as state parameter in OAuth URL
    const state = role ? btoa(JSON.stringify({ role })) : undefined;
    const url = state 
      ? `${API_URL}/auth/google?state=${encodeURIComponent(state)}`
      : `${API_URL}/auth/google`;
    window.location.href = url;
  }, []);

  // GitHub Login
  const loginWithGithub = useCallback((role?: 'STUDENT' | 'TEACHER') => {
    // Pass role as state parameter in OAuth URL
    const state = role ? btoa(JSON.stringify({ role })) : undefined;
    const url = state 
      ? `${API_URL}/auth/github?state=${encodeURIComponent(state)}`
      : `${API_URL}/auth/github`;
    window.location.href = url;
  }, []);

  // Request OTP
  const requestOtp = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send OTP');
      }
      return { success: true, message: result.message };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      // Clear local storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);

      router.push('/');
    } catch {
      // Still clear local data even if API call fails
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      
      router.push('/');
    }
  }, [router, setUser, setIsAuthenticated]);

  // Get user profile
  const getProfile = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setUser(result);
        localStorage.setItem('user', JSON.stringify(result));
        return result;
      }
    } catch (error) {
      console.error('Failed to get profile:', error);
    }

    return null;
  }, [setUser]);

  // Complete OAuth Registration
  const completeOAuthRegistration = useCallback(async (data: {
    provider: 'google' | 'github';
    socialId: string;
    email: string;
    fullName: string;
    avatar?: string;
    role: 'STUDENT' | 'TEACHER';
    // Teacher fields
    teacherCV?: File;
    teacherCertificates?: File[];
    teacherSubjects?: string;
    teacherExperience?: string;
    teacherSpecialty?: string;
    teacherIntroduction?: string;
    // Student fields
    studentID?: string;
    studentSchool?: string;
    studentClass?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      // For now, send as JSON (file uploads will be handled later)
      // TODO: Implement file upload to cloud storage first
      const jsonData = {
        provider: data.provider,
        socialId: data.socialId,
        email: data.email,
        fullName: data.fullName,
        avatar: data.avatar,
        role: data.role,
        // Teacher fields (files excluded for now)
        teacherSubjects: data.teacherSubjects,
        teacherExperience: data.teacherExperience,
        teacherSpecialty: data.teacherSpecialty,
        teacherIntroduction: data.teacherIntroduction,
        // Student fields
        studentID: data.studentID,
        studentSchool: data.studentSchool,
        studentClass: data.studentClass,
      };

      const response = await fetch(`${API_URL}/auth/complete-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'OAuth registration failed');
      }

      // Save tokens and user data
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      localStorage.setItem('user', JSON.stringify(result.user));
      
      setUser(result.user);
      setIsAuthenticated(true);
      setLoading(false);

      return { success: true, user: result.user };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'OAuth registration failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setUser, setIsAuthenticated]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    loginWithGoogle,
    loginWithGithub,
    verifyOtp,
    verify2FAOtp,
    requestOtp,
    logout,
    getProfile,
    completeOAuthRegistration,
    setUser, // Export setUser for manual updates
  };
}
