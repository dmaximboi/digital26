import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { signSessionJwt, verifySessionJwt } from "../lib/jwt.js";
import { authLimiter } from "../middleware/security.js";
import { writeAudit } from "../lib/audit.js";

export const authRouter = Router();

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

const MAX_CREDENTIAL_LEN = 4096;

function extractIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined;
  return first || req.socket.remoteAddress || "unknown";
}

// ─── Layer 1: Google verifies identity ───────────────────────
// ─── Layer 2: Backend checks STAFF_EMAILS + DB allowlist ─────
// ─── Layer 3: JWT signed with server-only secret ─────────────
authRouter.post("/auth/google", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body ?? {};
    if (!credential || typeof credential !== "string") {
      res.status(400).json({ error: "Google credential required" });
      return;
    }

    if (credential.length > MAX_CREDENTIAL_LEN) {
      res.status(400).json({ error: "Credential too large" });
      return;
    }

    if (!googleClient || !env.GOOGLE_CLIENT_ID) {
      res.status(503).json({ error: "Google Sign-In is not configured" });
      return;
    }

    // Layer 1: Google token verification (checks signature, expiry, audience)
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      res.status(401).json({ error: "Google email not verified" });
      return;
    }

    // Reject tokens older than 5 minutes (replay protection)
    const tokenAge = Math.floor(Date.now() / 1000) - (payload.iat ?? 0);
    if (tokenAge > 300 || tokenAge < -60) {
      res.status(401).json({ error: "Token expired or invalid" });
      return;
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0] || "User";
    const avatarUrl = payload.picture || null;
    const googleId = payload.sub;
    const ip = extractIp(req);

    // Layer 2: Check env allowlist + DB allowlist for admin role
    const isEnvAdmin = env.adminEmails.includes(email);
    const isEnvReadonly = env.readonlyEmails.includes(email);

    let isDbAdmin = false;
    try {
      const row = await prisma.adminAllowlist.findUnique({
        where: { email },
        select: { active: true, role: true },
      });
      if (row?.active && (row.role || "FULL").toUpperCase() !== "READONLY") {
        isDbAdmin = true;
      }
    } catch { /* table may not exist */ }

    const role = (isEnvAdmin || isDbAdmin) ? "ADMIN" : isEnvReadonly ? "READONLY" : "STUDENT";

    let user: { id: string; email: string; role: string; student: { status: string } | null };

    try {
      user = await prisma.user.upsert({
        where: { email },
        create: { email, name, avatarUrl, googleId, role },
        update: { name, avatarUrl, googleId, role },
        select: { id: true, email: true, role: true, student: { select: { status: true } } },
      });
    } catch {
      user = await prisma.user.upsert({
        where: { email },
        create: { email, name, role },
        update: { name, role },
        select: { id: true, email: true, role: true, student: { select: { status: true } } },
      });
    }

    // Layer 3: Issue our own JWT (signed with server-only JWT_SECRET)
    const token = await signSessionJwt({ userId: user.id, email: user.email, role: user.role });

    // Audit admin sign-ins
    if (role === "ADMIN" || role === "READONLY") {
      try {
        await writeAudit({
          adminEmail: email,
          action: "auth.signin",
          metadata: { ip, googleId, role },
        });
      } catch { /* audit table may not exist */ }
    }

    console.log(`[auth] sign-in: ${email} (${role}) from ${ip}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name,
        avatarUrl,
        role: user.role,
        studentStatus: user.student?.status ?? null,
        hasProfile: Boolean(user.student),
      },
    });
  } catch (err) {
    console.error("[auth.google]", err);
    res.status(401).json({ error: "Google authentication failed" });
  }
});

authRouter.get("/auth/me", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const token = header.slice(7);
    if (token.length > MAX_CREDENTIAL_LEN) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { userId, email, role } = await verifySessionJwt(token);

    let user: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      role: string;
      student: { status: string; fullName: string } | null;
    } | null;

    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, avatarUrl: true, role: true,
          student: { select: { status: true, fullName: true } },
        },
      });
    } catch {
      user = { id: userId, email, name: email.split("@")[0] || "User", avatarUrl: null, role, student: null };
    }

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Re-check admin status against both env AND DB on every request
    const isEnvAdmin = env.adminEmails.includes(user.email.toLowerCase());
    let isDbAdmin = false;
    try {
      const row = await prisma.adminAllowlist.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { active: true, role: true },
      });
      if (row?.active && (row.role || "FULL").toUpperCase() !== "READONLY") {
        isDbAdmin = true;
      }
    } catch { /* table may not exist */ }

    const effectiveRole = (isEnvAdmin || isDbAdmin) ? "ADMIN" : user.role;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: effectiveRole,
      studentStatus: user.student?.status ?? null,
      hasProfile: Boolean(user.student),
      canWrite: isEnvAdmin || isDbAdmin,
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

authRouter.get("/auth/google-client-id", (_req, res) => {
  res.json({ clientId: env.GOOGLE_CLIENT_ID || null });
});
