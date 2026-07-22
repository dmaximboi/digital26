import { env } from "../config/env.js";

/**
 * Admin gate: email must appear in server env ADMIN_EMAILS.
 * No DB allowlist table, no client-side list, no bootstrap token.
 * Passwords live only in Neon Auth (hashed).
 */
export function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  return env.adminEmails.includes(normalized);
}
