'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  avatar?: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);

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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: AuthResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'OTP verification failed');
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
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

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

      const result: AuthResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Login failed');
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
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

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
    } catch (err) {
      // Still clear local data even if API call fails
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      
      router.push('/');
    }
  }, [router]);

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
    } catch (err) {
      console.error('Failed to get profile:', err);
    }

    return null;
  }, []);

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
  }, []);

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
    requestOtp,
    logout,
    getProfile,
    completeOAuthRegistration,
  };
}
