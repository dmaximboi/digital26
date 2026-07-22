import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { apiPost } from "./api";

const PUBLIC_ROOTS = new Set([
  "",
  "verify",
  "check-agreement",
  "contact",
  "about",
  "a",
  "sign",
  "claim-cert",
]);

export function useVisitorBeacon() {
  const { pathname } = useLocation();

  useEffect(() => {
    const seg = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    if (!PUBLIC_ROOTS.has(seg)) return;

    const key = `d26_hit_${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }

    void apiPost("/api/public/hit", {
      path: pathname.slice(0, 300),
      referrer: typeof document !== "undefined" ? document.referrer.slice(0, 500) : "",
    }).catch(() => {
      /* ignore */
    });
  }, [pathname]);
}
