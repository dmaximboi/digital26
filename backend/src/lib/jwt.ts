import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env.js";

const ALG = "HS256";
const ISSUER = "digital26";
const MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

function getSecret(): Uint8Array {
  const key = env.JWT_SECRET || "dev-jwt-secret-must-change-in-prod";
  return new TextEncoder().encode(key);
}

export async function signSessionJwt(payload: {
  userId: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ sub: payload.userId, email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function verifySessionJwt(
  token: string,
): Promise<{ userId: string; email: string; role: string; payload: JWTPayload }> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    maxTokenAge: `${MAX_AGE_SEC}s`,
  });

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? (payload.email as string) : "";
  const role = typeof payload.role === "string" ? (payload.role as string) : "STUDENT";

  if (!userId || !email) throw new Error("INVALID_TOKEN");

  return { userId, email, role, payload };
}
