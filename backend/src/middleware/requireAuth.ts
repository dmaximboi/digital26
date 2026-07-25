import type { Request, Response, NextFunction } from "express";
import { verifySessionJwt } from "../lib/jwt.js";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

async function resolveRole(email: string): Promise<"ADMIN" | "READONLY" | null> {
  if (env.adminEmails.includes(email)) return "ADMIN";
  if (env.readonlyEmails.includes(email)) return "READONLY";

  try {
    const row = await prisma.adminAllowlist.findUnique({
      where: { email },
      select: { active: true, role: true },
    });
    if (!row?.active) return null;
    return (row.role || "FULL").toUpperCase() === "READONLY" ? "READONLY" : "ADMIN";
  } catch {
    return null;
  }
}

async function extractUser(req: AuthedRequest): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;

  try {
    const { userId, email, role } = await verifySessionJwt(header.slice(7));
    req.userId = userId;
    req.userEmail = email;

    // Always re-resolve admin status from env + DB (dual-layer verification)
    const adminRole = await resolveRole(email.toLowerCase());
    req.userRole = adminRole ?? role;

    return true;
  } catch {
    return false;
  }
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!(await extractUser(req))) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!(await extractUser(req))) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.userRole !== "ADMIN" && req.userRole !== "READONLY") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export async function requireAdminWrite(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!(await extractUser(req))) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.userRole !== "ADMIN") {
    res.status(403).json({ error: "Write access required" });
    return;
  }
  next();
}

export async function requireApprovedStudent(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!(await extractUser(req))) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  // Admins bypass student-approval check
  if (req.userRole === "ADMIN" || req.userRole === "READONLY") {
    next();
    return;
  }
  // Verify student is actually approved in DB
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId! },
      select: { status: true },
    });
    if (!profile || profile.status !== "APPROVED") {
      res.status(403).json({ error: "Student application not yet approved" });
      return;
    }
  } catch {
    res.status(403).json({ error: "Unable to verify student status" });
    return;
  }
  next();
}
