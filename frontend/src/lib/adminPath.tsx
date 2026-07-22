import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiGet } from "./api";

/** Normalize + validate admin URL segment from backend. */
export function normalizeAdminPath(raw: string): string | null {
  const v = raw.trim().replace(/^\/+|\/+$/g, "");
  if (!v) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,64}$/.test(v)) return null;
  return v;
}

let cachedPath: string | null = null;

/** Sync read after AdminPathProvider has loaded (or null). */
export function getAdminPath(): string | null {
  return cachedPath;
}

type AdminPathState = {
  path: string | null;
  ready: boolean;
};

const AdminPathContext = createContext<AdminPathState>({
  path: null,
  ready: false,
});

export function AdminPathProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string | null>(cachedPath);
  const [ready, setReady] = useState(Boolean(cachedPath));

  useEffect(() => {
    let cancelled = false;
    apiGet<{ path: string }>("/api/public/console-route")
      .then((data) => {
        if (cancelled) return;
        const next = normalizeAdminPath(data.path || "");
        cachedPath = next;
        setPath(next);
      })
      .catch(() => {
        if (cancelled) return;
        cachedPath = null;
        setPath(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ path, ready }), [path, ready]);
  return <AdminPathContext.Provider value={value}>{children}</AdminPathContext.Provider>;
}

export function useAdminPath(): AdminPathState {
  return useContext(AdminPathContext);
}
