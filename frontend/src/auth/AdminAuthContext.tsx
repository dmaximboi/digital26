import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authClient, type AuthUser } from "../lib/auth";
import { adminFetch } from "../lib/adminApi";

type AdminAuthState = {
  loading: boolean;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sessionResult = await authClient.getSession();
      const u = sessionResult.data?.user;
      if (!u?.email) {
        setUser(null);
        return;
      }

      // Confirm with API (server ADMIN_EMAILS) — no client allowlist
      try {
        const me = await adminFetch<{ email: string }>("/api/admin/me");
        if (me.email) {
          setUser({ id: u.id, email: me.email, name: u.name });
          return;
        }
      } catch {
        setUser(null);
        return;
      }

      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ loading, user, refresh, signOut }),
    [loading, user, refresh, signOut],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
