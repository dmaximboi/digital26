import { Router } from "express";
import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { authLimiter } from "../middleware/security.js";
import type { AuthedRequest } from "../middleware/adminAuth.js";
import { writeAudit } from "../lib/audit.js";

export const adminRouter = Router();

adminRouter.get("/admin/me", authLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  res.json({
    email: req.adminEmail,
    userId: req.adminUserId ?? null,
  });
});

adminRouter.get("/admin/dashboard", requireAdmin, async (req: AuthedRequest, res) => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    agreementsThisMonth,
    certsIssued,
    expiredUnusedLinks,
    pendingLinks,
    peopleCount,
    unreadMessages,
  ] = await Promise.all([
    prisma.agreement.count({
      where: { signedAt: { gte: monthStart }, consumedAt: { not: null } },
    }),
    prisma.certificate.count({ where: { status: "VALID" } }),
    prisma.agreement.count({
      where: {
        consumedAt: null,
        linkExpiresAt: { lt: now },
      },
    }),
    prisma.agreement.count({
      where: {
        consumedAt: null,
        linkExpiresAt: { gte: now },
      },
    }),
    prisma.person.count(),
    prisma.contactMessage.count({ where: { readAt: null } }),
  ]);

  await writeAudit({
    adminEmail: req.adminEmail!,
    action: "dashboard.view",
  });

  res.json({
    agreementsThisMonth,
    certsIssued,
    expiredUnusedLinks,
    pendingLinks,
    peopleCount,
    unreadMessages,
  });
});

adminRouter.get("/admin/agreements", requireAdmin, async (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = await prisma.agreement.findMany({
    where: q
      ? {
          OR: [
            { publicId: { contains: q, mode: "insensitive" } },
            { sessionId: { contains: q, mode: "insensitive" } },
            { person: { name: { contains: q, mode: "insensitive" } } },
            { person: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      person: { select: { id: true, name: true, email: true, phone: true } },
      public: { select: { publicId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({
    items: rows.map((a) => ({
      id: a.id,
      publicId: a.publicId,
      dealType: a.dealType,
      dealTag: a.otherDealText,
      signedAt: a.signedAt,
      consumedAt: a.consumedAt,
      linkExpiresAt: a.linkExpiresAt,
      pdfUrl: a.pdfUrl,
      person: { id: a.person.id, name: a.person.name },
      hasPublicCard: Boolean(a.public),
    })),
  });
});

adminRouter.get("/admin/agreements/:id", requireAdmin, async (req: AuthedRequest, res) => {
  const id = String(req.params.id ?? "");
  const a = await prisma.agreement.findUnique({
    where: { id },
    include: {
      person: true,
      public: true,
    },
  });
  if (!a) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await writeAudit({
    adminEmail: req.adminEmail!,
    action: "agreement.view",
    targetId: a.id,
  });

  res.json({
    id: a.id,
    publicId: a.publicId,
    dealType: a.dealType,
    otherDealText: a.otherDealText,
    signatureName: a.signatureName,
    signedAt: a.signedAt,
    consumedAt: a.consumedAt,
    linkExpiresAt: a.linkExpiresAt,
    requestingIp: a.requestingIp,
    pdfUrl: a.pdfUrl,
    photoUrl: a.photoUrl,
    hasNin: Boolean(a.ninEncrypted),
    person: {
      id: a.person.id,
      name: a.person.name,
    },
    publicCard: a.public,
  });
});

/** Explicit reveal of private contact — audited */
adminRouter.post(
  "/admin/people/:id/reveal-contact",
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id ?? "");
    const person = await prisma.person.findUnique({ where: { id } });
    if (!person) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await writeAudit({
      adminEmail: req.adminEmail!,
      action: "person.reveal_contact",
      targetId: id,
    });
    res.json({
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
    });
  },
);

adminRouter.get("/admin/certificates", requireAdmin, async (_req, res) => {
  const rows = await prisma.certificate.findMany({
    include: {
      person: { select: { id: true, name: true, email: true } },
    },
    orderBy: { issueDate: "desc" },
    take: 100,
  });

  res.json({
    items: rows.map((c) => ({
      id: c.id,
      publicId: c.publicId,
      type: c.type,
      course: c.course,
      issueDate: c.issueDate,
      status: c.status,
      pdfUrl: c.pdfUrl,
      claimSessionId: c.claimSessionId,
      claimExpiresAt: c.claimExpiresAt,
      claimedAt: c.claimedAt,
      person: c.person ? { id: c.person.id, name: c.person.name } : null,
    })),
  });
});

adminRouter.get("/admin/clients", requireAdmin, async (_req, res) => {
  const people = await prisma.person.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      agreements: {
        select: {
          id: true,
          publicId: true,
          dealType: true,
          signedAt: true,
          consumedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      certificates: {
        select: {
          id: true,
          publicId: true,
          type: true,
          issueDate: true,
          status: true,
        },
        orderBy: { issueDate: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ items: people });
});

adminRouter.get("/admin/audit", requireAdmin, async (_req, res) => {
  const items = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  res.json({ items });
});

/** Admin-only PDF download (agreement letter + both cert types). Not public. */
adminRouter.get("/admin/files/:kind/:filename", requireAdmin, async (req, res) => {
  const kind = String(req.params.kind ?? "");
  const filename = String(req.params.filename ?? "");

  if (!["agreements", "certificates"].includes(kind)) {
    res.status(400).json({ error: "Invalid kind" });
    return;
  }
  // New: D26xxxxxxxx.pdf — Legacy: D2600001cert.pdf etc.
  if (!/^D26[A-Za-z0-9\-_~.]+(?:agr|cert)?\.pdf$/i.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const root = path.resolve(env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads"));
  const filePath = path.resolve(root, kind, filename);
  const rel = path.relative(root, filePath);
  if (rel.startsWith("..") || path.isAbsolute(rel) || !existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  createReadStream(filePath).pipe(res);
});
