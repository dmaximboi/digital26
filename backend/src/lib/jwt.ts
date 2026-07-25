import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env.js";

const ALG = "HS256";
const ISSUER = "digital26";
const STUDENT_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const ADMIN_MAX_AGE = 12 * 60 * 60; // 12 hours (shorter for admins)
const MAX_TOKEN_LEN = 2048;

function getSecret(): Uint8Array {
  const key = env.JWT_SECRET || "dev-jwt-secret-must-change-in-prod";
  return new TextEncoder().encode(key);
}

export async function signSessionJwt(payload: {
  userId: string;
  email: string;
  role: string;
}): Promise<string> {
  const isAdmin = payload.role === "ADMIN" || payload.role === "READONLY";
  const maxAge = isAdmin ? ADMIN_MAX_AGE : STUDENT_MAX_AGE;

  return new SignJWT({ sub: payload.userId, email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());
}

export async function verifySessionJwt(
  token: string,
): Promise<{ userId: string; email: string; role: string; payload: JWTPayload }> {
  if (token.length > MAX_TOKEN_LEN) throw new Error("TOKEN_TOO_LARGE");

  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
  });

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? (payload.email as string) : "";
  const role = typeof payload.role === "string" ? (payload.role as string) : "STUDENT";

  if (!userId || !email) throw new Error("INVALID_TOKEN");

  // Verify token hasn't exceeded max age for its role
  if (typeof payload.iat === "number") {
    const age = Math.floor(Date.now() / 1000) - payload.iat;
    const isAdmin = role === "ADMIN" || role === "READONLY";
    const maxAge = isAdmin ? ADMIN_MAX_AGE : STUDENT_MAX_AGE;
    if (age > maxAge || age < -60) throw new Error("TOKEN_EXPIRED");
  }

  return { userId, email, role, payload };
}
