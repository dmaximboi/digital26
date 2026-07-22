import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { NextFunction, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { isAdminEmail } from "../lib/admins.js";
import type { AuthedRequest } from "./adminAuth.js";

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

async function emailFromNeonAuthUser(userId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM neon_auth."user" WHERE id::text = ${userId} LIMIT 1
    `;
    const email = rows[0]?.email;
    return email ? email.toLowerCase() : null;
  } catch (err) {
    console.error("neon_auth.user lookup failed", err);
    return null;
  }
}

async function verifyNeonJwt(token: string): Promise<{
  email: string;
  userId: string;
  payload: JWTPayload;
}> {
  if (!JWKS || !env.NEON_AUTH_URL) {
    throw new Error("NEON_AUTH_NOT_CONFIGURED");
  }

  const issuerCandidates = [
    env.NEON_AUTH_URL.replace(/\/$/, ""),
    new URL(env.NEON_AUTH_URL).origin,
  ];

  let payload: JWTPayload | null = null;
  let lastError: unknown;

  for (const issuer of issuerCandidates) {
    try {
      const verified = await jwtVerify(token, JWKS, { issuer });
      payload = verified.payload;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!payload) {
    throw lastError instanceof Error ? lastError : new Error("INVALID_TOKEN");
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) throw new Error("INVALID_TOKEN");

  let email = emailFromPayload(payload);
  if (!email) {
    email = await emailFromNeonAuthUser(userId);
  }
  if (!email) throw new Error("EMAIL_NOT_FOUND");

  return { email, userId, payload };
}

/**
 * Admin gate: Neon Auth JWT only. Email must be in server ADMIN_EMAILS.
 * No bootstrap / shared secret bypass.
 */
export async function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim() ?? "";

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!JWKS || !env.NEON_AUTH_URL) {
    res.status(503).json({ error: "Admin auth is not configured" });
    return;
  }

  try {
    const { email, userId } = await verifyNeonJwt(token);
    if (!isAdminEmail(email)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.adminEmail = email;
    req.adminUserId = userId;
    next();
  } catch (err) {
    console.error("Admin JWT verify failed", err instanceof Error ? err.message : err);
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
