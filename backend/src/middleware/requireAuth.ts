import type { Request, Response, NextFunction } from "express";
import { verifySessionJwt } from "../lib/jwt.js";
import { prisma } from "../db/prisma.js";
import { currentStaffRole } from "../lib/admins.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

async function extractUser(req: AuthedRequest): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;

  try {
    const { userId, email } = await verifySessionJwt(header.slice(7));
    req.userId = userId;
    req.userEmail = email;

    // Never trust an admin role embedded in an older token. Re-check the
    // current allowlist so revocation and read-only changes apply immediately.
    req.userRole = (await currentStaffRole(email)) ?? "STUDENT";

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
  if (req.userRole === "ADMIN" || req.userRole === "READONLY") {
    next();
    return;
  }
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
