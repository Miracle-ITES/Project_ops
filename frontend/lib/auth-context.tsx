"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, login as apiLogin, logout as apiLogout, refresh as apiRefresh } from "./api-client";
import { getRefreshToken } from "./token-store";
import type { UserOut } from "@/types/auth";

interface AuthContextValue {
  user: UserOut | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On first load, an access token doesn't exist yet (it's memory-only and
  // this is a fresh page load), so if a refresh token was persisted, use
  // it to silently restore the session instead of forcing a re-login.
  useEffect(() => {
    (async () => {
      if (getRefreshToken()) {
        const tokens = await apiRefresh();
        if (tokens) {
          try {
            const me = await getMe();
            setUser(me);
          } catch {
            setUser(null);
          }
        }
      }
      setIsLoading(false);
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

  function hasPermission(code: string) {
    return user?.role.permissions.includes(code) ?? false;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
