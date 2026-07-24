import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function inEnvStaff(email: string): boolean {
  return env.adminEmails.includes(email);
}

function inEnvReadonly(email: string): boolean {
  return env.readonlyEmails.includes(email);
}

/** Env staff + active DB allowlist rows. */
export async function isAuthorizedStaff(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return false;
  if (inEnvStaff(normalized) || inEnvReadonly(normalized)) return true;

  try {
    const row = await prisma.adminAllowlist.findUnique({
      where: { email: normalized },
      select: { active: true },
    });
    return Boolean(row?.active);
  } catch {
    // DB allowlist unavailable — fall back to env only
    return false;
  }
}

/** Full write access: STAFF_EMAILS or active DB allowlist (not readonly env list). */
export async function canWriteOps(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (inEnvStaff(normalized)) return true;
  if (inEnvReadonly(normalized)) return false;

  try {
    const row = await prisma.adminAllowlist.findUnique({
      where: { email: normalized },
      select: { active: true, role: true },
    });
    if (!row?.active) return false;
    return (row.role || "FULL").toUpperCase() !== "READONLY";
  } catch {
    return false;
  }
}

/** Sync STAFF_EMAILS into admin_allowlist so revoke can happen via DB later. */
export async function bootstrapStaffAllowlist(): Promise<void> {
  for (const email of env.adminEmails) {
    try {
      await prisma.adminAllowlist.upsert({
        where: { email },
        create: { email, active: true, role: "FULL" },
        update: { active: true, role: "FULL" },
      });
    } catch (err) {
      console.warn("[auth] allowlist bootstrap skipped for", email, err);
    }
  }
  for (const email of env.readonlyEmails) {
    try {
      await prisma.adminAllowlist.upsert({
        where: { email },
        create: { email, active: true, role: "READONLY" },
        update: { active: true, role: "READONLY" },
      });
    } catch (err) {
      console.warn("[auth] readonly allowlist bootstrap skipped for", email, err);
    }
  }
}

/** @deprecated use isAuthorizedStaff */
export function isAdminEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return inEnvStaff(normalized) || inEnvReadonly(normalized);
}
