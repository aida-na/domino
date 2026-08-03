'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { dominoApi } from './domino-api';

function identifyUser(phone: string) {
  posthog.identify(phone);
}

function resetUser() {
  posthog.reset();
}

const SESSION_KEY = 'domino_session';
const PHONE_KEY = 'domino_phone';

interface DominoAuthContextType {
  phone: string | null;
  sessionToken: string | null;
  isLoading: boolean;
  hasPassword: boolean | null;
  loginWithToken: (token: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const DominoAuthContext = createContext<DominoAuthContextType | null>(null);

export function DominoAuthProvider({ children }: { children: React.ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      const storedToken = localStorage.getItem(SESSION_KEY);
      const storedPhone = localStorage.getItem(PHONE_KEY);

      if (!storedToken || !storedPhone) {
        setIsLoading(false);
        return;
      }

      setSessionToken(storedToken);
      setPhone(storedPhone);
      setIsLoading(false);

      dominoApi
        .getMe(storedToken)
        .then((me) => {
          setHasPassword(me.has_password ?? false);
          identifyUser(me.phone);
        })
        .catch(() => {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(PHONE_KEY);
          setSessionToken(null);
          setPhone(null);
          setHasPassword(null);
          resetUser();
        });
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = sessionToken ?? (typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null);
    if (!token) return;
    const me = await dominoApi.getMe(token);
    setHasPassword(me.has_password ?? false);
  }, [sessionToken]);

  const loginWithToken = useCallback(async (token: string) => {
    const me = await dominoApi.getMe(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, token);
      localStorage.setItem(PHONE_KEY, me.phone);
    }
    setSessionToken(token);
    setPhone(me.phone);
    setHasPassword(me.has_password ?? false);
    identifyUser(me.phone);
  }, []);

  const logout = useCallback(async () => {
    if (sessionToken) {
      await dominoApi.logout(sessionToken).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(PHONE_KEY);
    }
    setSessionToken(null);
    setPhone(null);
    setHasPassword(null);
    resetUser();
  }, [sessionToken]);

  return (
    <DominoAuthContext.Provider
      value={{ phone, sessionToken, isLoading, hasPassword, loginWithToken, refreshProfile, logout }}
    >
      {children}
    </DominoAuthContext.Provider>
  );
}

export function useDominoAuth() {
  const ctx = useContext(DominoAuthContext);
  if (!ctx) throw new Error('useDominoAuth must be used within DominoAuthProvider');
  return ctx;
}
