import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setMemoryToken, setUnauthorizedHandler } from '../api/axiosClient';
import { isUserSession } from '../lib/guards';
import { safeStorage } from '../lib/storage';
import type { UserSession } from '../types';

export type { UserSession } from '../types';

const SESSION_KEY = 'sc_session';

interface AuthContextType {
  session: UserSession | null;
  setSession: (session: UserSession | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Corrupt or tampered storage must never crash the app on load. */
export const readStoredSession = (): UserSession | null => {
  const raw = safeStorage.get(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isUserSession(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  safeStorage.remove(SESSION_KEY);
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(readStoredSession);

  // Only non-secret display data is persisted. The credential itself is an httpOnly cookie.
  useEffect(() => {
    if (session) safeStorage.set(SESSION_KEY, JSON.stringify(session));
    else safeStorage.remove(SESSION_KEY);
  }, [session]);

  const logout = useCallback(() => {
    setMemoryToken(null);
    setSession(null);
  }, []);

  // Any 401 from a protected endpoint means the cookie expired: drop the session, guards redirect.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo(() => ({ session, setSession, logout }), [session, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within an AuthProvider');
  return context;
};
