import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { setAdminPin as setApiAdminPin } from '../services/api';

const ADMIN_SESSION_KEY = 'adminSession';
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface AdminSession {
  pin: string;
  expiresAt: number;
}

interface AdminContextType {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  adminPin: string | null;
  setAdminPin: (pin: string | null) => void;
  clearAdminSession: () => void;
  refreshSession: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

function getStoredSession(): AdminSession | null {
  try {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;
    
    const session: AdminSession = JSON.parse(stored);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function storeSession(pin: string): void {
  const session: AdminSession = {
    pin,
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  };
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

function clearStoredSession(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPinState] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      setAdminPinState(session.pin);
      setApiAdminPin(session.pin);
      setIsAdmin(true);
    }
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startSessionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = window.setTimeout(() => {
      // Session expired
      setAdminPinState(null);
      setApiAdminPin(null);
      setIsAdmin(false);
      clearStoredSession();
    }, SESSION_TIMEOUT_MS);
  }, []);

  const refreshSession = useCallback(() => {
    if (adminPin) {
      storeSession(adminPin);
      startSessionTimeout();
    }
  }, [adminPin, startSessionTimeout]);

  const setAdminPin = useCallback((pin: string | null) => {
    setAdminPinState(pin);
    setApiAdminPin(pin);
    setIsAdmin(!!pin);
    
    if (pin) {
      storeSession(pin);
      startSessionTimeout();
    } else {
      clearStoredSession();
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    }
  }, [startSessionTimeout]);

  const clearAdminSession = useCallback(() => {
    setAdminPinState(null);
    setApiAdminPin(null);
    setIsAdmin(false);
    clearStoredSession();
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  return (
    <AdminContext.Provider value={{ 
      isAdmin, 
      setIsAdmin, 
      adminPin, 
      setAdminPin, 
      clearAdminSession,
      refreshSession 
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
