import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
const TOKEN_KEY = "d26_token";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "ADMIN" | "READONLY" | "STUDENT";
  studentStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  hasProfile: boolean;
  canWrite: boolean;
};

type AuthState = {
  loading: boolean;
  user: AppUser | null;
  signIn: (googleCredential: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);

  const fetchMe = useCallback(async (token: string): Promise<AppUser | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as AppUser;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await fetchMe(token);
      if (me) {
        setUser(me);
      } else {
        clearToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchMe]);

  const signIn = useCallback(async (credential: string) => {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        (data as { error?: string }).error || "Sign-in failed",
      );
    }
    const data = (await res.json()) as { token: string; user: AppUser };
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    try {
      const g = (window as unknown as {
        google?: { accounts?: { id?: { disableAutoSelect?: () => void; revoke?: (email: string, cb: () => void) => void } } };
      }).google;
      g?.accounts?.id?.disableAutoSelect?.();
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ loading, user, signIn, signOut, refresh }),
    [loading, user, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
