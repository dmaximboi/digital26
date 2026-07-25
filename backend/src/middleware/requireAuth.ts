import type { Request, Response, NextFunction } from "express";
import { verifySessionJwt } from "../lib/jwt.js";
import { env } from "../config/env.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

async function extractUser(req: AuthedRequest): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;

  try {
    const { userId, email, role } = await verifySessionJwt(header.slice(7));
    req.userId = userId;
    req.userEmail = email;
    req.userRole = env.adminEmails.includes(email.toLowerCase()) ? "ADMIN" : role;
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
  next();
}
