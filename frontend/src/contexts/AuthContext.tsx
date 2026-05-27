'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clearAuthStorage, getStoredToken, getStoredUser, isTokenExpired } from '@/lib/authStorage';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  avatar?: string;
  twoFactorEnabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const hydrateFromStorage = () => {
    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (!token || !storedUser || isTokenExpired(token)) {
      clearAuthStorage();
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error parsing stored user:', err);
      clearAuthStorage();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Load user from localStorage on mount
  useEffect(() => {
    hydrateFromStorage();
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (['accessToken', 'refreshToken', 'user', 'userId', 'role', 'token'].includes(event.key)) {
        hydrateFromStorage();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        hydrateFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Sync user state to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      localStorage.removeItem('role');
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, setUser, setIsAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
