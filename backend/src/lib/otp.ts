import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { hashPasskey } from "./crypto.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function otpHashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function issueEmailOtp(opts: {
  email: string;
  purpose: string;
  sessionId?: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.emailOtp.create({
    data: {
      email: opts.email.toLowerCase(),
      codeHash: hashOtp(code),
      purpose: opts.purpose,
      sessionId: opts.sessionId,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function verifyEmailOtp(opts: {
  email: string;
  purpose: string;
  code: string;
  sessionId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = opts.email.toLowerCase();

  const latest = await prisma.emailOtp.findFirst({
    where: {
      email,
      purpose: opts.purpose,
      consumedAt: null,
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return { ok: false, error: "No active verification code. Request a new one." };
  }

  if (latest.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Verification code expired. Request a new one." };
  }

  if (latest.attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, error: "Too many invalid code attempts. Request a new one." };
  }

  const incoming = hashOtp(opts.code);
  const match = otpHashesEqual(incoming, latest.codeHash);

  if (!match) {
    await prisma.emailOtp.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Invalid verification code." };
  }

  await prisma.emailOtp.update({
    where: { id: latest.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}

export { hashPasskey };
