'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAccessToken } from '../lib/api';
import { User } from '@commitra/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  rehydrate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const login = () => {
    // Redirects to API login route which triggers GitHub OAuth redirection
    window.location.href = 'http://localhost:3001/api/auth/github';
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      // Log logout failures gracefully
      console.error('Logout backend call failed', err);
    } finally {
      setAccessToken('');
      setUser(null);
      router.push('/login');
    }
  };

  const rehydrate = async () => {
    setLoading(true);
    try {
      // Call profile endpoint. If unauthorized (e.g. fresh load, expired token),
      // the axios interceptor catches it, executes POST /refresh, then replays this request.
      const response = await api.get('/api/auth/me');
      setUser(response.data.data.user);
    } catch (error) {
      setUser(null);
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (!path.includes('/login') && !path.includes('/callback')) {
          router.push('/login');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    rehydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, rehydrate }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useUser must be used within an AuthProvider');
  }
  return context;
};
