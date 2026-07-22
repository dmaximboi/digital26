import {
  createContext,
  useContext,
  useMemo,
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
  ready: true,
});

export function ConsolePathProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const path = useMemo(() => {
    const seg = pathname.split("/").filter(Boolean)[0] ?? "";
    return normalizeConsolePath(seg);
  }, [pathname]);

  const value = useMemo(() => ({ path, ready: true }), [path]);
  return (
    <ConsolePathContext.Provider value={value}>{children}</ConsolePathContext.Provider>
  );
}

export function useConsolePath(): ConsolePathState {
  return useContext(ConsolePathContext);
}

export function getConsolePath(): string | null {
  if (typeof window === "undefined") return null;
  const seg = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  return normalizeConsolePath(seg);
}

export const AdminPathProvider = ConsolePathProvider;
export const useAdminPath = useConsolePath;
export const getAdminPath = getConsolePath;
export const normalizeAdminPath = normalizeConsolePath;
