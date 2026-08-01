import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { isValidPublicId } from "../lib/publicId.js";
import { publicLookupLimiter, templateDownloadLimiter, gateLimiter } from "../middleware/security.js";
import { optimizedPhotoUrl } from "../lib/studentPhoto.js";
import { cacheFetch } from "../lib/cache.js";
import {
  issueTemplateDownloadToken,
  verifyTemplateDownloadToken,
} from "../lib/downloadToken.js";
import { PAYMENT_AMOUNTS_USD } from "../lib/payments.js";

export const publicRouter = Router();

function clientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

function safeEqualStr(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const gateSchema = z.object({
  path: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
});

publicRouter.post("/gate", gateLimiter, (req, res) => {
  const parsed = gateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(200).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: safeEqualStr(parsed.data.path, env.consolePath) });
});

const hitSchema = z.object({
  path: z.string().min(1).max(300),
  referrer: z.string().max(500).optional(),
});

publicRouter.post("/hit", publicLookupLimiter, async (req, res) => {
  const parsed = hitSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(204).end();
    return;
  }

  const ua = String(req.headers["user-agent"] ?? "").slice(0, 400);
  try {
    await prisma.siteVisit.create({
      data: {
        ip: clientIp(req).slice(0, 64),
        path: parsed.data.path,
        referrer: parsed.data.referrer?.trim() || null,
        userAgent: ua || null,
      },
    });
  } catch {
    /* ignore write failures */
  }
  res.status(204).end();
});

function verifyUrl(publicId: string): string {
  const base = (env.PUBLIC_SITE_URL || env.APP_URL).replace(/\/$/, "");
  return `${base}/verify/${encodeURIComponent(publicId)}`;
}

function certMarkdown(record: {
  publicId: string;
  displayName: string;
  course: string;
  type: string;
  issueDate: Date;
  status: string;
}): string {
  return [
    `# Digital 26 Certificate`,
    ``,
    `- **ID:** ${record.publicId}`,
    `- **Name:** ${record.displayName}`,
    `- **Course:** ${record.course}`,
    `- **Type:** ${record.type}`,
    `- **Status:** ${record.status}`,
    `- **Issue date:** ${record.issueDate.toISOString().slice(0, 10)}`,
    `- **Verify:** ${verifyUrl(record.publicId)}`,
  ].join("\n");
}

publicRouter.get("/verify/:publicId", publicLookupLimiter, async (req, res) => {
  const publicId = String(req.params.publicId ?? "").trim();

  if (!isValidPublicId(publicId)) {
    res.status(400).json({ error: "Invalid certificate ID format" });
    return;
  }

  const record = await cacheFetch(
    `cert:${publicId}`,
    () => prisma.certificatePublic.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        displayName: true,
        course: true,
        type: true,
        issueDate: true,
        status: true,
        photoUrl: true,
      },
    }),
    5 * 60 * 1000,
  );

  if (!record) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }

  let accessPaid = false;
  let canDownloadTemplatePng = false;
  let downloadToken: string | null = null;
  try {
    const row = await prisma.certificate.findUnique({
      where: { publicId },
      select: { templatePngDownloadedAt: true, status: true, viewPaidAt: true },
    });
    accessPaid = Boolean(row?.viewPaidAt);
    canDownloadTemplatePng =
      accessPaid &&
      Boolean(row) &&
      row!.status === "VALID" &&
      !row!.templatePngDownloadedAt;
    if (canDownloadTemplatePng) {
      downloadToken = issueTemplateDownloadToken("certificate", publicId).token;
    }
  } catch {
    canDownloadTemplatePng = false;
  }

  let photoUrl = accessPaid ? record.photoUrl : null;
  if (record.status !== "VALID") {
    photoUrl = null;
  } else if (photoUrl && !photoUrl.startsWith("http") && !photoUrl.startsWith("/")) {
    photoUrl = `/api/public/files/students/${photoUrl}`;
  }
  if (photoUrl) {
    photoUrl = optimizedPhotoUrl(photoUrl, 400, 70);
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const wantsText =
    String(req.query.format ?? "").toLowerCase() === "md" ||
    String(req.query.format ?? "").toLowerCase() === "txt" ||
    /text\/plain|text\/markdown/i.test(String(req.headers.accept ?? ""));

  if (wantsText) {
    if (!accessPaid) {
      res.type("text/markdown; charset=utf-8").send(
        [
          `# Certificate ${record.publicId}`,
          "",
          `Status: ${record.status}`,
          `Type: ${record.type}`,
          "",
          `Full certificate art unlocks after a one-time $${PAYMENT_AMOUNTS_USD.CERTIFICATE} USD payment (charged in local currency at checkout).`,
        ].join("\n"),
      );
      return;
    }
    res.type("text/markdown; charset=utf-8").send(certMarkdown(record));
    return;
  }

  // Download / paywall eligibility must not be long-cached
  res.setHeader("Cache-Control", "no-store");
  res.json({
    publicId: record.publicId,
    name: accessPaid ? record.displayName : "Locked",
    course: accessPaid ? record.course : null,
    type: record.type,
    issueDate: accessPaid ? record.issueDate : null,
    status: record.status,
    photoUrl,
    verifyUrl: verifyUrl(record.publicId),
    issuer: "The Digital 26",
    program: "Vibe Coding",
    accessPaid,
    amountUsd: PAYMENT_AMOUNTS_USD.CERTIFICATE,
    canDownloadTemplatePng,
    downloadToken,
  });
});

publicRouter.post(
  "/verify/:publicId/template-png",
  templateDownloadLimiter,
  async (req, res) => {
  const publicId = String(req.params.publicId ?? "").trim();
  if (!isValidPublicId(publicId)) {
    res.status(400).json({ error: "Invalid certificate ID format" });
    return;
  }

  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!verifyTemplateDownloadToken("certificate", publicId, token)) {
    res.status(403).json({ error: "Invalid or expired download token" });
    return;
  }

  const unpaid = await prisma.certificate.findUnique({
    where: { publicId },
    select: { viewPaidAt: true },
  });
  if (!unpaid?.viewPaidAt) {
    res.status(402).json({
      error: `Pay $${PAYMENT_AMOUNTS_USD.CERTIFICATE} USD to unlock this certificate before downloading`,
    });
    return;
  }

  const claimed = await prisma.certificate.updateMany({
    where: {
      publicId,
      status: "VALID",
      viewPaidAt: { not: null },
      templatePngDownloadedAt: null,
    },
    data: { templatePngDownloadedAt: new Date() },
  });

  if (claimed.count === 0) {
    const exists = await prisma.certificate.findUnique({
      where: { publicId },
      select: { id: true, templatePngDownloadedAt: true },
    });
    if (!exists) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }
    res.status(410).json({ error: "One-time template download already used" });
    return;
  }

  try {
    const pub = await prisma.certificatePublic.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        displayName: true,
        course: true,
        type: true,
        issueDate: true,
        status: true,
        photoUrl: true,
      },
    });
    if (!pub) {
      await prisma.certificate.updateMany({
        where: { publicId },
        data: { templatePngDownloadedAt: null },
      });
      res.status(404).json({ error: "Certificate not found" });
      return;
    }

    const { buildCertificateTemplatePng } = await import("../lib/certPng.js");
    const png = await buildCertificateTemplatePng({
      publicId: pub.publicId,
      displayName: pub.displayName,
      course: pub.course,
      type: pub.type,
      issueDate: pub.issueDate,
      status: pub.status,
      photoUrl: pub.photoUrl,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${publicId}-template.png"`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(png);
  } catch (err) {
    console.error("[public.verify.template-png]", err);
    await prisma.certificate.updateMany({
      where: { publicId },
      data: { templatePngDownloadedAt: null },
    });
    res.status(500).json({ error: "Failed to generate template PNG" });
  }
});

publicRouter.get("/a/:publicId", publicLookupLimiter, async (req, res) => {
  const publicId = String(req.params.publicId ?? "").trim();

  if (!isValidPublicId(publicId)) {
    res.status(400).json({ error: "Invalid agreement ID format" });
    return;
  }

  const record = await cacheFetch(
    `agr:${publicId}`,
    () => prisma.agreementPublic.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        displayName: true,
        dealType: true,
        dealTag: true,
        signedAt: true,
        signatureName: true,
      },
    }),
    5 * 60 * 1000,
  );

  if (!record) {
    res.status(404).json({ error: "Agreement not found" });
    return;
  }

  let accessPaid = false;
  let canDownloadTemplatePng = false;
  let downloadToken: string | null = null;
  try {
    const row = await prisma.agreement.findUnique({
      where: { publicId },
      select: { templatePngDownloadedAt: true, consumedAt: true, viewPaidAt: true },
    });
    accessPaid = Boolean(row?.viewPaidAt);
    canDownloadTemplatePng =
      accessPaid && Boolean(row?.consumedAt) && !row!.templatePngDownloadedAt;
    if (canDownloadTemplatePng) {
      downloadToken = issueTemplateDownloadToken("agreement", publicId).token;
    }
  } catch {
    canDownloadTemplatePng = false;
  }

  res.setHeader("Cache-Control", "no-store");

  res.json({
    publicId: record.publicId,
    name: accessPaid ? record.displayName : "Locked",
    dealType: accessPaid ? record.dealType : null,
    dealTag: accessPaid ? record.dealTag : null,
    signedAt: accessPaid ? record.signedAt : null,
    signature: accessPaid ? record.signatureName : null,
    issuer: "The Digital 26",
    accessPaid,
    amountUsd: PAYMENT_AMOUNTS_USD.AGREEMENT,
    canDownloadTemplatePng,
    downloadToken,
  });
});

publicRouter.post(
  "/a/:publicId/template-png",
  templateDownloadLimiter,
  async (req, res) => {
  const publicId = String(req.params.publicId ?? "").trim();
  if (!isValidPublicId(publicId)) {
    res.status(400).json({ error: "Invalid agreement ID format" });
    return;
  }

  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!verifyTemplateDownloadToken("agreement", publicId, token)) {
    res.status(403).json({ error: "Invalid or expired download token" });
    return;
  }

  const unpaid = await prisma.agreement.findUnique({
    where: { publicId },
    select: { viewPaidAt: true },
  });
  if (!unpaid?.viewPaidAt) {
    res.status(402).json({
      error: `Pay $${PAYMENT_AMOUNTS_USD.AGREEMENT} USD to unlock this agreement before downloading`,
    });
    return;
  }

  const claimed = await prisma.agreement.updateMany({
    where: {
      publicId,
      consumedAt: { not: null },
      viewPaidAt: { not: null },
      templatePngDownloadedAt: null,
    },
    data: { templatePngDownloadedAt: new Date() },
  });

  if (claimed.count === 0) {
    const exists = await prisma.agreement.findUnique({
      where: { publicId },
      select: { id: true, templatePngDownloadedAt: true },
    });
    if (!exists) {
      res.status(404).json({ error: "Agreement not found" });
      return;
    }
    res.status(410).json({ error: "One-time template download already used" });
    return;
  }

  try {
    const pub = await prisma.agreementPublic.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        displayName: true,
        dealTag: true,
        signatureName: true,
        signedAt: true,
      },
    });
    if (!pub) {
      await prisma.agreement.updateMany({
        where: { publicId },
        data: { templatePngDownloadedAt: null },
      });
      res.status(404).json({ error: "Agreement not found" });
      return;
    }

    const { buildAgreementTemplatePng } = await import("../lib/certPng.js");
    const png = await buildAgreementTemplatePng({
      publicId: pub.publicId,
      displayName: pub.displayName,
      dealTag: pub.dealTag,
      signatureName: pub.signatureName,
      signedAt: pub.signedAt,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${publicId}-template.png"`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(png);
  } catch (err) {
    console.error("[public.agreement.template-png]", err);
    await prisma.agreement.updateMany({
      where: { publicId },
      data: { templatePngDownloadedAt: null },
    });
    res.status(500).json({ error: "Failed to generate template PNG" });
  }
});
