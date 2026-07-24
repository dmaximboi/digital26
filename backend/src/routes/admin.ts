import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireAdmin, requireAdminWrite } from "../middleware/requireAdmin.js";
import { authLimiter } from "../middleware/security.js";
import type { AuthedRequest } from "../middleware/adminAuth.js";
import { writeAudit } from "../lib/audit.js";
import { buildAgreementPdf, buildCertificatePdf } from "../lib/pdf.js";
import { isValidPublicId } from "../lib/publicId.js";
import { studentPhotoAbsoluteUrl } from "../lib/studentPhoto.js";
import { canWriteOps } from "../lib/admins.js";

export const adminRouter = Router();

adminRouter.get("/ops/me", authLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  const email = req.adminEmail!;
  res.json({
    email,
    userId: req.adminUserId ?? null,
    canWrite: await canWriteOps(email),
  });
});

adminRouter.get("/ops/dashboard", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

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

    let visitsToday = 0;
    let visitsTotal = 0;
    try {
      [visitsToday, visitsTotal] = await Promise.all([
        prisma.siteVisit.count({ where: { createdAt: { gte: dayStart } } }),
        prisma.siteVisit.count(),
      ]);
    } catch (err) {
      console.warn("[dashboard] site_visits unavailable:", err);
    }

    try {
      await writeAudit({
        adminEmail: req.adminEmail!,
        action: "dashboard.view",
      });
    } catch (err) {
      console.warn("[dashboard] audit write failed:", err);
    }

    res.json({
      agreementsThisMonth,
      certsIssued,
      expiredUnusedLinks,
      pendingLinks,
      peopleCount,
      unreadMessages,
      visitsToday,
      visitsTotal,
    });
  } catch (err) {
    console.error("[dashboard]", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

adminRouter.get("/ops/visits", requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const [total, today, todayRows, items] = await Promise.all([
      prisma.siteVisit.count(),
      prisma.siteVisit.count({ where: { createdAt: { gte: dayStart } } }),
      prisma.siteVisit.findMany({
        where: { createdAt: { gte: dayStart } },
        select: { ip: true },
      }),
      prisma.siteVisit.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    const uniqueIpsToday = new Set(todayRows.map((r) => r.ip)).size;

    res.json({
      total,
      today,
      uniqueIpsToday,
      items,
    });
  } catch (err) {
    console.error("[visits]", err);
    res.status(503).json({
      error: "Visitor table is not ready yet. Redeploy API with prisma db push.",
      total: 0,
      today: 0,
      uniqueIpsToday: 0,
      items: [],
    });
  }
});

adminRouter.get("/ops/agreements", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const q = String(req.query.q ?? "").trim();

    // Try with evidence count; fall back without if the table doesn't exist yet
    let rows: Array<{
      id: string;
      publicId: string | null;
      dealType: string;
      otherDealText: string | null;
      signedAt: Date | null;
      consumedAt: Date | null;
      linkExpiresAt: Date;
      pdfUrl: string | null;
      person: { id: string; name: string };
      public: { publicId: string } | null;
      _count?: { evidence: number };
    }>;

    const where = q
      ? {
          OR: [
            { publicId: { contains: q, mode: "insensitive" as const } },
            { sessionId: { contains: q, mode: "insensitive" as const } },
            { person: { name: { contains: q, mode: "insensitive" as const } } },
            { person: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : undefined;

    try {
      rows = await prisma.agreement.findMany({
        where,
        include: {
          person: { select: { id: true, name: true, email: true, phone: true } },
          public: { select: { publicId: true } },
          _count: { select: { evidence: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    } catch {
      rows = await prisma.agreement.findMany({
        where,
        include: {
          person: { select: { id: true, name: true, email: true, phone: true } },
          public: { select: { publicId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    }

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
        canDownloadPdf: Boolean(a.publicId && a.consumedAt),
        evidenceCount: a._count?.evidence ?? 0,
        person: { id: a.person.id, name: a.person.name },
        hasPublicCard: Boolean(a.public),
      })),
    });
  } catch (err) {
    console.error("[agreements.list]", err);
    res.status(500).json({ error: "Failed to load agreements" });
  }
});

adminRouter.get("/ops/agreements/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id ?? "");

    type EvidenceRow = { id: string; kind: string; url: string; phoneHint: string | null; uploadedBy: string; createdAt: Date };

    let result: {
      id: string; publicId: string | null; dealType: string; otherDealText: string | null;
      signatureName: string | null; signedAt: Date | null; consumedAt: Date | null;
      linkExpiresAt: Date; requestingIp: string | null; pdfUrl: string | null;
      photoUrl: string | null; ninEncrypted: string | null;
      person: { id: string; name: string };
      public: unknown;
      evidence: EvidenceRow[];
    } | null = null;

    try {
      const a = await prisma.agreement.findUnique({
        where: { id },
        include: {
          person: true,
          public: true,
          evidence: {
            orderBy: { createdAt: "asc" },
            select: { id: true, kind: true, url: true, phoneHint: true, uploadedBy: true, createdAt: true },
          },
        },
      });
      if (a) {
        result = { ...a, evidence: a.evidence as EvidenceRow[] };
      }
    } catch {
      const a = await prisma.agreement.findUnique({
        where: { id },
        include: { person: true, public: true },
      });
      if (a) {
        result = { ...a, evidence: [] };
      }
    }

    if (!result) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      await writeAudit({ adminEmail: req.adminEmail!, action: "agreement.view", targetId: result.id });
    } catch { /* audit table may not exist */ }

    const evidence = result.evidence.map((e) => ({
      ...e,
      url: e.url.startsWith("http") ? e.url : studentPhotoAbsoluteUrl(e.url),
    }));

    res.json({
      id: result.id,
      publicId: result.publicId,
      dealType: result.dealType,
      otherDealText: result.otherDealText,
      signatureName: result.signatureName,
      signedAt: result.signedAt,
      consumedAt: result.consumedAt,
      linkExpiresAt: result.linkExpiresAt,
      requestingIp: result.requestingIp,
      pdfUrl: result.pdfUrl,
      canDownloadPdf: Boolean(result.publicId && result.consumedAt),
      photoUrl: result.photoUrl,
      hasNin: Boolean(result.ninEncrypted),
      person: { id: result.person.id, name: result.person.name },
      publicCard: result.public,
      evidence,
    });
  } catch (err) {
    console.error("[agreements.detail]", err);
    res.status(500).json({ error: "Failed to load agreement" });
  }
});


adminRouter.post(
  "/ops/people/:id/reveal-contact",
  authLimiter,
  requireAdminWrite,
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

adminRouter.get("/ops/certificates", requireAdmin, async (_req, res) => {
  try {
    let rows: Array<{
      id: string;
      publicId: string | null;
      type: string;
      course: string;
      issueDate: Date;
      status: string;
      pdfUrl: string | null;
      claimSessionId: string | null;
      claimExpiresAt: Date | null;
      claimedAt: Date | null;
      person: { id: string; name: string } | null;
      evidence?: Array<{ id: string; kind: string; url: string; phoneHint: string | null; uploadedBy: string; createdAt: Date }>;
      _count?: { evidence: number };
    }>;

    try {
      rows = await prisma.certificate.findMany({
        include: {
          person: { select: { id: true, name: true, email: true } },
          evidence: {
            orderBy: { createdAt: "asc" },
            select: { id: true, kind: true, url: true, phoneHint: true, uploadedBy: true, createdAt: true },
          },
          _count: { select: { evidence: true } },
        },
        orderBy: { issueDate: "desc" },
        take: 100,
      });
    } catch {
      rows = await prisma.certificate.findMany({
        include: {
          person: { select: { id: true, name: true, email: true } },
        },
        orderBy: { issueDate: "desc" },
        take: 100,
      });
    }

    res.json({
      items: rows.map((c) => ({
        id: c.id,
        publicId: c.publicId,
        type: c.type,
        course: c.course,
        issueDate: c.issueDate,
        status: c.status,
        pdfUrl: c.pdfUrl,
        canDownloadPdf: Boolean(c.publicId && c.status === "VALID"),
        claimSessionId: c.claimSessionId,
        claimExpiresAt: c.claimExpiresAt,
        claimedAt: c.claimedAt,
        evidenceCount: c._count?.evidence ?? 0,
        evidence: (c.evidence ?? []).map((e) => ({
          ...e,
          url: e.url.startsWith("http") ? e.url : studentPhotoAbsoluteUrl(e.url),
        })),
        person: c.person ? { id: c.person.id, name: c.person.name } : null,
      })),
    });
  } catch (err) {
    console.error("[certificates.list]", err);
    res.status(500).json({ error: "Failed to load certificates" });
  }
});

adminRouter.get("/ops/clients", requireAdmin, async (_req, res) => {
  try {
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
  } catch (err) {
    console.error("[clients.list]", err);
    res.status(500).json({ error: "Failed to load clients" });
  }
});

adminRouter.get("/ops/audit", requireAdmin, async (_req, res) => {
  try {
    const items = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
    });
    res.json({ items });
  } catch (err) {
    console.error("[audit.list]", err);
    res.status(500).json({ error: "Audit log not available" });
  }
});


adminRouter.get("/ops/files/:kind/:filename", requireAdmin, async (req, res) => {
  const kind = String(req.params.kind ?? "");
  const filename = String(req.params.filename ?? "");

  if (!["agreements", "certificates"].includes(kind)) {
    res.status(400).json({ error: "Invalid kind" });
    return;
  }

  if (!filename.toLowerCase().endsWith(".pdf")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const publicId = filename.replace(/\.pdf$/i, "");
  if (!isValidPublicId(publicId)) {
    res.status(400).json({ error: "Invalid public ID" });
    return;
  }

  try {
    // Always rebuild from DB — Render disk is ephemeral, so stored files often 404.
    if (kind === "agreements") {
      const record = await prisma.agreementPublic.findUnique({
        where: { publicId },
        include: {
          agreement: {
            select: {
              termsSnapshot: true,
              signatureName: true,
              signedAt: true,
            },
          },
        },
      });
      if (!record) {
        res.status(404).json({ error: "Agreement not found" });
        return;
      }
      const signedAt = record.signedAt ?? record.agreement?.signedAt;
      if (!signedAt) {
        res.status(404).json({ error: "Agreement not signed yet" });
        return;
      }
      const pdf = await buildAgreementPdf({
        publicId: record.publicId,
        displayName: record.displayName,
        dealType: record.dealType,
        dealTag: record.dealTag,
        signatureName:
          record.signatureName ||
          record.agreement?.signatureName ||
          record.displayName,
        signedAt,
        terms: record.agreement?.termsSnapshot || "",
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdf.bytes));
      return;
    }

    const cert = await prisma.certificatePublic.findUnique({
      where: { publicId },
      include: {
        certificate: {
          select: {
            photoUrl: true,
            status: true,
          },
        },
      },
    });
    if (!cert) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }
    const pdf = await buildCertificatePdf({
      publicId: cert.publicId,
      displayName: cert.displayName,
      course: cert.course,
      type: cert.type,
      issueDate: cert.issueDate,
      status: cert.status,
      photoUrl: cert.photoUrl || cert.certificate?.photoUrl || undefined,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdf.bytes));
  } catch (err) {
    console.error("[ops.files]", err);
    res.status(500).json({ error: "Failed to build PDF" });
  }
});
