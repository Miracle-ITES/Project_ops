"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getMe, login as apiLogin, logout as apiLogout, refresh as apiRefresh } from "./api-client";
import { getRefreshToken } from "./token-store";
import type { UserOut } from "@/types/auth";

interface AuthContextValue {
  user: UserOut | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasRestoredSession = useRef(false);

  // On first load, an access token doesn't exist yet (it's memory-only and
  // this is a fresh page load), so if a refresh token was persisted, use
  // it to silently restore the session instead of forcing a re-login.
  useEffect(() => {
    if (hasRestoredSession.current) return;
    hasRestoredSession.current = true;

    (async () => {
      try {
        if (getRefreshToken()) {
          const tokens = await apiRefresh();

          if (tokens) {
            const me = await getMe();
            setUser(me);
          }
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    await apiLogin(email, password);
    const me = await getMe();
    setUser(me);
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  async function refreshUser() {
    setUser(await getMe());
  }

  function hasPermission(code: string) {
    return user?.role.permissions.includes(code) ?? false;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
