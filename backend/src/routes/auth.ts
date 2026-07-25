import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { signSessionJwt, verifySessionJwt } from "../lib/jwt.js";
import { authLimiter } from "../middleware/security.js";

export const authRouter = Router();

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

authRouter.post("/auth/google", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body ?? {};
    if (!credential || typeof credential !== "string") {
      res.status(400).json({ error: "Google credential required" });
      return;
    }

    if (!googleClient || !env.GOOGLE_CLIENT_ID) {
      res.status(503).json({ error: "Google Sign-In is not configured" });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      res.status(401).json({ error: "Google email not verified" });
      return;
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0] || "User";
    const avatarUrl = payload.picture || null;
    const googleId = payload.sub;

    const isAdmin = env.adminEmails.includes(email);
    const isReadonly = env.readonlyEmails.includes(email);
    const role = isAdmin ? "ADMIN" : isReadonly ? "READONLY" : "STUDENT";

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

    const token = await signSessionJwt({ userId: user.id, email: user.email, role: user.role });

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

    const { userId, email, role } = await verifySessionJwt(header.slice(7));

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

    const isAdmin = env.adminEmails.includes(user.email.toLowerCase());
    const effectiveRole = isAdmin ? "ADMIN" : user.role;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: effectiveRole,
      studentStatus: user.student?.status ?? null,
      hasProfile: Boolean(user.student),
      canWrite: isAdmin,
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

authRouter.get("/auth/google-client-id", (_req, res) => {
  res.json({ clientId: env.GOOGLE_CLIENT_ID || null });
});
