import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { isValidPublicId } from "../lib/publicId.js";
import { publicLookupLimiter } from "../middleware/security.js";

export const publicRouter = Router();

function clientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

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

  const record = await prisma.certificatePublic.findUnique({
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

  if (!record) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }

  let photoUrl = record.photoUrl;
  if (photoUrl && !photoUrl.startsWith("http") && !photoUrl.startsWith("/")) {
    photoUrl = `/api/public/files/students/${photoUrl}`;
  }

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const wantsText =
    String(req.query.format ?? "").toLowerCase() === "md" ||
    String(req.query.format ?? "").toLowerCase() === "txt" ||
    /text\/plain|text\/markdown/i.test(String(req.headers.accept ?? ""));

  if (wantsText) {
    res.type("text/markdown; charset=utf-8").send(certMarkdown(record));
    return;
  }

  res.json({
    publicId: record.publicId,
    name: record.displayName,
    course: record.course,
    type: record.type,
    issueDate: record.issueDate,
    status: record.status,
    photoUrl,
    verifyUrl: verifyUrl(record.publicId),
    issuer: "The Digital 26",
    program: "Vibe Coding",
  });
});

publicRouter.get("/a/:publicId", publicLookupLimiter, async (req, res) => {
  const publicId = String(req.params.publicId ?? "").trim();

  if (!isValidPublicId(publicId)) {
    res.status(400).json({ error: "Invalid agreement ID format" });
    return;
  }

  const record = await prisma.agreementPublic.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      displayName: true,
      dealType: true,
      dealTag: true,
      signedAt: true,
      signatureName: true,
    },
  });

  if (!record) {
    res.status(404).json({ error: "Agreement not found" });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");

  res.json({
    publicId: record.publicId,
    name: record.displayName,
    dealType: record.dealType,
    dealTag: record.dealTag,
    signedAt: record.signedAt,
    signature: record.signatureName,
    issuer: "The Digital 26",
  });
});
