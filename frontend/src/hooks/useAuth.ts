'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { clearAuthStorage, clearWatchProgressForUser, dispatchAuthStateChanged } from '@/lib/authStorage';

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
  const currentUserId = user?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to check if token is expired or about to expire
  const isTokenExpiringSoon = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Return true if token expires in less than 5 minutes
      return timeUntilExpiry < 5 * 60 * 1000;
    } catch (error) {
      console.error('Error parsing token:', error);
      return true; // Treat invalid tokens as expired
    }
  };

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      return false;
    }

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
        return true;
      } else {
        // If refresh fails, logout
        clearWatchProgressForUser(currentUserId);
        clearAuthStorage();
        setUser(null);
        setIsAuthenticated(false);
        dispatchAuthStateChanged();
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }, [currentUserId, setUser, setIsAuthenticated]);

  // Check token on mount and refresh if needed
  useEffect(() => {
    let isMounted = true;

    const checkAndRefreshToken = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');

        // Only check if both tokens exist.
        if (accessToken && refreshToken && isTokenExpiringSoon(accessToken)) {
          console.log('Token expiring soon, refreshing...');
          const refreshed = await refreshAccessToken();

          if (!refreshed) {
            console.log('Token refresh failed, logging out');
            router.push('/');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAndRefreshToken();

    return () => {
      isMounted = false;
    };
  }, [refreshAccessToken, router]);

  // Auto-refresh token every 14 minutes (before 15min expiry)
  useEffect(() => {
    // Only set up auto-refresh if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    // Refresh token every 14 minutes (840000ms)
    const interval = setInterval(refreshAccessToken, 14 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshAccessToken, isAuthenticated]);


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
        dispatchAuthStateChanged();
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
        dispatchAuthStateChanged();
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

      const result = await response.json() as AuthResponse & { requires2FA?: boolean; email?: string; bannedUntil?: string };

      if (!response.ok) {
        return {
          success: false,
          error: result.message || 'Login failed',
          bannedUntil: result.bannedUntil,
        };
      }

      // Check if 2FA is required
      if (result.requires2FA) {
        setLoading(false);
        return { 
          success: true, 
          requires2FA: true, 
          email: result.email!,
          message: result.message,
          bannedUntil: result.bannedUntil,
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

      if (finalUser?.role === 'TEACHER') {
        try {
          const profileKey = `pending-teacher-profile:${data.email.toLowerCase()}`;
          const cvKey = `pending-teacher-cv:${data.email.toLowerCase()}`;
          const rawProfile = sessionStorage.getItem(profileKey);
          if (rawProfile) {
            const payload = JSON.parse(rawProfile) as {
              subjects?: string[];
              experience?: number;
              education?: string;
              bio?: string;
            };
            const fd = new FormData();
            if (payload.subjects && payload.subjects.length > 0) {
              payload.subjects.forEach((s) => fd.append('subjects[]', s));
            }
            if (payload.experience !== undefined) {
              fd.append('experience', String(payload.experience));
            }
            if (payload.education) {
              fd.append('education', payload.education);
            }
            const rawCv = sessionStorage.getItem(cvKey);
            if (rawCv) {
              const cvInfo = JSON.parse(rawCv) as { name: string; type: string; data: string };
              const byteString = atob(cvInfo.data);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
              const cvBlob = new Blob([ab], { type: cvInfo.type });
              fd.append('cv', cvBlob, cvInfo.name);
            }
            if (payload.bio) {
              await fetch(`${API_URL}/auth/profile`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${result.accessToken}`,
                },
                body: JSON.stringify({ bio: payload.bio }),
              });
            }
            await fetch(`${API_URL}/auth/profile/teacher/upload-cv`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${result.accessToken}` },
              body: fd,
            });
            sessionStorage.removeItem(profileKey);
            sessionStorage.removeItem(cvKey);
          }
        } catch {
          console.warn('Failed to upload pending teacher profile or CV, but login will proceed anyway');
        }
      }

      setIsAuthenticated(true);
      dispatchAuthStateChanged();
      setLoading(false);

      return { success: true, user: finalUser, bannedUntil: undefined };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage, bannedUntil: undefined };
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

      clearWatchProgressForUser(currentUserId);

      // Clear local storage
      clearAuthStorage();

      setUser(null);
      setIsAuthenticated(false);
      dispatchAuthStateChanged();
      setLoading(false);

      router.push('/');
    } catch {
      clearWatchProgressForUser(currentUserId);

      // Still clear local data even if API call fails
      clearAuthStorage();
      
      setUser(null);
      setIsAuthenticated(false);
      dispatchAuthStateChanged();
      setLoading(false);
      
      router.push('/');
    }
  }, [currentUserId, router, setUser, setIsAuthenticated]);

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
    teacherIntroduction?: string;
    subjects?: string[];
    experience?: number;
    education?: string;
    website?: string;
    linkedin?: string;
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
        teacherIntroduction: data.teacherIntroduction,
        subjects: data.subjects,
        experience: data.experience,
        education: data.education,
        website: data.website,
        linkedin: data.linkedin,
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
      dispatchAuthStateChanged();
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
    refreshAccessToken, // Export for manual refresh
    setUser, // Export setUser for manual updates
  };
}