import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;

function secret(): string {
  return env.JWT_SECRET || env.FIELD_ENCRYPTION_KEY || "d26-dev-download-secret";
}

/** Short-lived HMAC token so one-time PNG downloads cannot be hotlinked blindly. */
export function issueTemplateDownloadToken(
  kind: "certificate" | "agreement",
  publicId: string,
): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${kind}:${publicId}:${expiresAt}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { token: `${expiresAt}.${sig}`, expiresAt };
}

export function verifyTemplateDownloadToken(
  kind: "certificate" | "agreement",
  publicId: string,
  token: unknown,
): boolean {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [expStr, sig] = token.split(".");
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  if (!sig || sig.length < 16) return false;

  const payload = `${kind}:${publicId}:${expiresAt}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
