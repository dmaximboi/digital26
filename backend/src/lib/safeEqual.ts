import { timingSafeEqual } from "node:crypto";

/** Constant-time equality for invite email checks (same length after normalize). */
export function emailsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a.trim().toLowerCase(), "utf8");
  const right = Buffer.from(b.trim().toLowerCase(), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
