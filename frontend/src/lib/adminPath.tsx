import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

const RESERVED = new Set([
  "verify",
  "check-agreement",
  "contact",
  "about",
  "a",
  "sign",
  "claim-cert",
  "ops",
  "admin",
  "api",
  "health",
  "assets",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "sw.js",
  "workbox",
]);

const VERIFIED_KEY = "d26_console_path";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function normalizeConsolePath(raw: string): string | null {
  const v = raw.trim().replace(/^\/+|\/+$/g, "");
  if (!v) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,64}$/.test(v)) return null;
  if (RESERVED.has(v.toLowerCase())) return null;
  return v;
}

type ConsolePathState = {
  path: string | null;
  ready: boolean;
};

const ConsolePathContext = createContext<ConsolePathState>({
  path: null,
  ready: false,
});

function envConsolePath(): string | null {
  return normalizeConsolePath(import.meta.env.VITE_CONSOLE_PATH || "");
}

async function verifyConsolePath(candidate: string): Promise<boolean> {
  const fromEnv = envConsolePath();
  if (fromEnv) return candidate === fromEnv;

  try {
    const res = await fetch(`${API_BASE}/api/public/gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ path: candidate }),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { ok?: unknown };
    return data.ok === true;
  } catch {
    return false;
  }
}

export function ConsolePathProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const candidate = useMemo(() => {
    const seg = pathname.split("/").filter(Boolean)[0] ?? "";
    return normalizeConsolePath(seg);
  }, [pathname]);

  const [state, setState] = useState<ConsolePathState>({
    path: null,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!candidate) {
        if (!cancelled) setState({ path: null, ready: true });
        return;
      }

      const ok = await verifyConsolePath(candidate);
      if (cancelled) return;

      if (ok) {
        sessionStorage.setItem(VERIFIED_KEY, candidate);
        setState({ path: candidate, ready: true });
      } else {
        const prev = sessionStorage.getItem(VERIFIED_KEY);
        if (prev === candidate) sessionStorage.removeItem(VERIFIED_KEY);
        setState({ path: null, ready: true });
      }
    }

    setState((s) => ({ ...s, ready: false }));
    void run();
    return () => {
      cancelled = true;
    };
  }, [candidate]);

  return (
    <ConsolePathContext.Provider value={state}>{children}</ConsolePathContext.Provider>
  );
}

export function useConsolePath(): ConsolePathState {
  return useContext(ConsolePathContext);
}

export function getConsolePath(): string | null {
  if (typeof window === "undefined") return null;
  const seg = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  const candidate = normalizeConsolePath(seg);
  if (!candidate) return null;

  const fromEnv = envConsolePath();
  if (fromEnv) return candidate === fromEnv ? candidate : null;

  const verified = sessionStorage.getItem(VERIFIED_KEY);
  return verified === candidate ? candidate : null;
}

export const AdminPathProvider = ConsolePathProvider;
export const useAdminPath = useConsolePath;
export const getAdminPath = getConsolePath;
export const normalizeAdminPath = normalizeConsolePath;
