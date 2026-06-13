import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { authAPI, tokenStore } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import type { PlatformRole } from "../lib/rbac";

export interface User {
  id: string;
  email: string;
  name?: string;
  /** Phase 10A: platform-level role */
  role?: PlatformRole | string;
  plan?: string;
  credits?: number;
  avatar?: string;
  is_active?: boolean;
  last_login_at?: string;
  email_verified?: boolean;
  [key: string]: any;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (formData: any) => Promise<any>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  refreshUser: () => Promise<User | null>;
  token: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const tok = tokenStore.get();
    if (!tok) { setIsLoading(false); return; }
    authAPI.me()
      .then(({ user: u }: any) => setUser(u))
      .catch(() => { tokenStore.clear(); setUser(null); })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => { setUser(null); queryClient.clear(); };
    window.addEventListener("autoflowng:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("autoflowng:unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authAPI.login({ email, password });
    tokenStore.set(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (formData: any) => {
    const data = await authAPI.register(formData);
    tokenStore.set(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
    authAPI.logout().catch(() => {});
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: u } = await authAPI.me() as any;
      setUser(u);
      return u;
    } catch { return null; }
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user && tokenStore.exists(),
    login,
    register,
    logout,
    updateUser,
    refreshUser,
    token: tokenStore.get,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
