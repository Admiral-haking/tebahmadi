'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContextValue, AuthStatus, AuthUser } from './types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = text || response.statusText || 'Request failed';
    throw new Error(error);
  }

  return response.json() as Promise<T>;
}

export function AuthProvider({ children }: ChildrenProps) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initialized = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setStatus('loading');
    try {
      const data = await fetchJson<{ user: AuthUser }>('/api/me');
      setUserState(data.user);
      setStatus('authenticated');
      setError(null);
    } catch (err) {
      setUserState(null);
      setStatus('unauthenticated');
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to fetch user');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'Failed to sign out');
      }
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setUserState(null);
      setStatus('unauthenticated');
      setIsLoading(false);
    }
  }, []);

  const setUser = useCallback((value: AuthUser | null) => {
    setUserState(value);
    setStatus(value ? 'authenticated' : 'unauthenticated');
    if (value) {
      setError(null);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (initialized.current) {
        return;
      }
      initialized.current = true;
      refresh().catch(() => {
        // refresh handles errors internally
      });
    }, 1e3);
  }, []);

  const value: AuthContextValue = {
    user,
    status,
    isLoading,
    error,
    refresh,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
