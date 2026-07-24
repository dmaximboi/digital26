import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { NextFunction, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { canWriteOps, isAuthorizedStaff } from "../lib/admins.js";
import type { AuthedRequest } from "./adminAuth.js";

const MAX_TOKEN_CHARS = 8192;
/** Reject tokens older than 12h even if exp is longer (defense in depth). */
const MAX_TOKEN_AGE_SEC = 12 * 60 * 60;

const jwksUrl = env.NEON_AUTH_JWKS_URL
  ? new URL(env.NEON_AUTH_JWKS_URL)
  : env.NEON_AUTH_URL
    ? new URL(`${env.NEON_AUTH_URL.replace(/\/$/, "")}/.well-known/jwks.json`)
    : null;

const JWKS = jwksUrl ? createRemoteJWKSet(jwksUrl) : null;

function emailFromPayload(payload: JWTPayload): string | null {
  const email = payload.email;
  if (typeof email === "string" && email.includes("@")) {
    return email.toLowerCase();
  }
  return null;
}

function emailVerifiedOk(payload: JWTPayload): boolean {
  if (!("email_verified" in payload)) return true;
  const v = payload.email_verified;
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return true;
}

async function emailFromNeonAuthUser(userId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM neon_auth."user" WHERE id::text = ${userId} LIMIT 1
    `;
    const email = rows[0]?.email;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function verifyNeonJwt(token: string): Promise<{
  email: string;
  userId: string;
  payload: JWTPayload;
}> {
  if (!JWKS || !env.NEON_AUTH_URL) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  if (token.length > MAX_TOKEN_CHARS) {
    throw new Error("TOKEN_TOO_LARGE");
  }

  const issuerCandidates = [
    env.NEON_AUTH_URL.replace(/\/$/, ""),
    new URL(env.NEON_AUTH_URL).origin,
  ];

  let payload: JWTPayload | null = null;
  let lastError: unknown;

  for (const issuer of issuerCandidates) {
    try {
      const verified = await jwtVerify(token, JWKS, {
        issuer,
        clockTolerance: 15,
      });
      payload = verified.payload;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!payload) {
    throw lastError instanceof Error ? lastError : new Error("INVALID_TOKEN");
  }

  if (typeof payload.exp !== "number") {
    throw new Error("TOKEN_MISSING_EXP");
  }

  if (typeof payload.iat === "number") {
    const age = Math.floor(Date.now() / 1000) - payload.iat;
    if (age > MAX_TOKEN_AGE_SEC || age < -60) {
      throw new Error("TOKEN_TOO_OLD");
    }
  }

  if (!emailVerifiedOk(payload)) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) throw new Error("INVALID_TOKEN");

  let email = emailFromPayload(payload);
  if (!email) {
    // Prefer claim; DB lookup only as fallback for older Neon tokens
    email = await emailFromNeonAuthUser(userId);
  }
  if (!email) throw new Error("EMAIL_NOT_FOUND");

  return { email, userId, payload };
}

async function authenticate(
  req: AuthedRequest,
  res: Response,
): Promise<{ email: string; userId: string } | null> {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim() ?? "";

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (!JWKS || !env.NEON_AUTH_URL) {
    res.status(503).json({ error: "Auth is not configured" });
    return null;
  }

  try {
    const { email, userId } = await verifyNeonJwt(token);
    if (!(await isAuthorizedStaff(email))) {
      res.status(403).json({ error: "Forbidden — not on staff allowlist" });
      return null;
    }
    req.adminEmail = email;
    req.adminUserId = userId;
    return { email, userId };
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }
}

/** Authenticate + authorize any staff (FULL or READONLY). */
export async function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = await authenticate(req, res);
  if (!auth) return;
  next();
}

/** Authenticate + authorize write/mutation privileges only. */
export async function requireAdminWrite(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = await authenticate(req, res);
  if (!auth) return;
  if (!(await canWriteOps(auth.email))) {
    res.status(403).json({ error: "Forbidden — read-only staff cannot mutate" });
    return;
  }
  next();
}
