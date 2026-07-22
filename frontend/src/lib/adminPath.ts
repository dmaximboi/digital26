/**
 * Admin console base path — from VITE_ADMIN_PATH only.
 * Never commit a real value; leave unset in public examples.
 * Must be URL-safe: letters, numbers, hyphen.
 */
export function getAdminPath(): string | null {
  const raw = (import.meta.env.VITE_ADMIN_PATH || "").trim().replace(/^\/+|\/+$/g, "");
  if (!raw) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,64}$/.test(raw)) return null;
  return raw;
}
