import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authClient, clearAccessToken, getAccessToken, type AuthUser } from "../lib/auth";
import { adminFetch } from "../lib/adminApi";

type AdminAuthState = {
  loading: boolean;
  user: AuthUser | null;
  canWrite: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [canWrite, setCanWrite] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sessionResult = await authClient.getSession();
      const u = sessionResult.data?.user;
      if (!u?.email) {
        setUser(null);
        setCanWrite(false);
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        setCanWrite(false);
        return;
      }

      try {
        const me = await adminFetch<{ email: string; canWrite?: boolean }>("/api/ops/me");
        if (me.email) {
          setUser({ id: u.id, email: me.email, name: u.name });
          setCanWrite(me.canWrite !== false);
          return;
        }
      } catch {
        clearAccessToken();
        await authClient.signOut().catch(() => undefined);
        setUser(null);
        setCanWrite(false);
        return;
      }

      setUser(null);
      setCanWrite(false);
    } catch {
      setUser(null);
      setCanWrite(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    clearAccessToken();
    await authClient.signOut();
    setUser(null);
    setCanWrite(false);
  }, []);

  const value = useMemo(
    () => ({ loading, user, canWrite, refresh, signOut }),
    [loading, user, canWrite, refresh, signOut],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
