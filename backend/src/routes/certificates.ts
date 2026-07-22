import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import { CertificateStatus, CertificateType } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { nextPublicId } from "../lib/publicId.js";
import { writeAudit } from "../lib/audit.js";
import { buildCertificatePdf } from "../lib/pdf.js";
import { generateSessionId } from "../lib/crypto.js";
import { issueEmailOtp, verifyEmailOtp } from "../lib/otp.js";
import { sendOtpEmail, sendCertificateClaimEmail } from "../lib/mail.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { authLimiter } from "../middleware/security.js";
import type { AuthedRequest } from "../middleware/adminAuth.js";
import { emailsEqual } from "../lib/safeEqual.js";
import { compressAndStoreStudentPhoto } from "../lib/studentPhoto.js";

export const certificatesRouter = Router();

const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

const uploadDir = path.resolve(process.cwd(), "uploads", "students");
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

const inviteSchema = z.object({
  type: z.nativeEnum(CertificateType),
  course: z.string().min(2).max(200).default("6-Day Vibe Coding Masterclass"),
  issueDate: z.string().datetime().or(z.string().min(4)),
  studentEmail: z.string().email(),
});


certificatesRouter.post(
  "/ops/certificates",
  authLimiter,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    try {
      const parsed = inviteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const data = parsed.data;
      const issueDate = new Date(data.issueDate);
      if (Number.isNaN(issueDate.getTime())) {
        res.status(400).json({ error: "Invalid issueDate" });
        return;
      }

      const inviteEmail = data.studentEmail.toLowerCase();
      const claimSessionId = generateSessionId();
      const claimExpiresAt = new Date(Date.now() + CLAIM_TTL_MS);

      const cert = await prisma.certificate.create({
        data: {
          type: data.type,
          course: data.course,
          issueDate,
          status: CertificateStatus.PENDING,
          inviteEmail,
          claimSessionId,
          claimExpiresAt,
        },
      });

      const claimLink = `${env.APP_URL}/claim-cert/${claimSessionId}`;

      const mail = await sendCertificateClaimEmail({
        to: inviteEmail,
        claimLink,
      });

      try {
        await writeAudit({
          adminEmail: req.adminEmail!,
          action: "certificate.invite",
          targetId: cert.id,
          metadata: {
            claimSessionId,
            type: cert.type,
            inviteEmail,
            claimExpiresAt: claimExpiresAt.toISOString(),
            emailDelivered: mail.delivered,
          },
        });
      } catch (err) {
        console.warn("[certificate.invite] audit failed:", err);
      }

      res.status(201).json({
        id: cert.id,
        type: cert.type,
        course: cert.course,
        issueDate: cert.issueDate,
        claimSessionId,
        claimLink,
        claimExpiresAt,
        hoursValid: 24,
        status: "PENDING",
        inviteEmail,
        emailDelivered: mail.delivered,
        emailError: mail.error ?? null,
        message: mail.delivered
          ? "Certificate claim link created and emailed (valid 24 hours)."
          : "Certificate claim link created, but email could not be sent. Copy the link below and share it manually.",
      });
    } catch (err) {
      console.error("[certificate.invite]", err);
      res.status(500).json({ error: "Failed to create certificate invite" });
    }
  },
);

certificatesRouter.get("/claim-cert/:sessionId/status", async (req, res) => {
  const sessionId = String(req.params.sessionId ?? "");
  const cert = await prisma.certificate.findUnique({
    where: { claimSessionId: sessionId },
    select: {
      type: true,
      course: true,
      issueDate: true,
      claimExpiresAt: true,
      claimedAt: true,
      status: true,
      publicId: true,
    },
  });

  if (!cert) {
    res.status(404).json({ status: "invalid" });
    return;
  }
  if (cert.claimedAt || cert.status !== CertificateStatus.PENDING) {
    res.json({
      status: "consumed",
      publicId: cert.publicId,
      publicUrl: cert.publicId
        ? `${env.PUBLIC_SITE_URL}/verify/${cert.publicId}`
        : null,
    });
    return;
  }
  if (cert.claimExpiresAt && cert.claimExpiresAt.getTime() < Date.now()) {
    res.json({ status: "expired" });
    return;
  }

  res.json({
    status: "pending_claim",
    type: cert.type,
    course: cert.course,
    issueDate: cert.issueDate,
    expiresAt: cert.claimExpiresAt,
    emailLocked: true,
  });
});

certificatesRouter.post(
  "/claim-cert/:sessionId/otp/request",
  authLimiter,
  async (req, res) => {
    const sessionId = String(req.params.sessionId ?? "");
    let email: string;
    try {
      email = z.string().email().parse(req.body?.email).toLowerCase();
    } catch {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }

    const cert = await prisma.certificate.findUnique({
      where: { claimSessionId: sessionId },
    });
    if (!cert || cert.claimedAt || cert.status !== CertificateStatus.PENDING) {
      res.status(410).json({ error: "Claim link invalid or already used" });
      return;
    }
    if (cert.claimExpiresAt && cert.claimExpiresAt.getTime() < Date.now()) {
      res.status(410).json({ error: "Claim link expired" });
      return;
    }
    if (!cert.inviteEmail) {
      res.status(400).json({ error: "This claim invite is misconfigured. Request a new link." });
      return;
    }
    if (!emailsEqual(email, cert.inviteEmail)) {
      res.status(400).json({
        error: "Unable to verify this request. Check the email address and try again.",
      });
      return;
    }

    const issued = await issueEmailOtp({
      email,
      purpose: "cert_claim",
      sessionId,
    });
    if ("error" in issued) {
      res.status(429).json({ error: issued.error });
      return;
    }
    await sendOtpEmail({ to: email, code: issued.code });
    res.json({ ok: true, message: "Verification code sent" });
  },
);

certificatesRouter.post(
  "/claim-cert/:sessionId/submit",
  authLimiter,
  (req, res, next) => {
    upload.single("photo")(req, res, (err: unknown) => {
      if (err) {
        const message =
          err instanceof Error ? err.message : "Photo upload failed";
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const sessionId = String(req.params.sessionId ?? "");
      const parsed = z
        .object({
          fullName: z.string().min(2).max(120),
          email: z.string().email(),
          phone: z.string().min(5).max(32),
          otpCode: z.string().regex(/^\d{6}$/),
        })
        .safeParse({
          fullName: req.body?.fullName,
          email: req.body?.email,
          phone: req.body?.phone,
          otpCode: req.body?.otpCode,
        });

      if (!parsed.success) {
        res.status(400).json({ error: "Invalid claim details or OTP format" });
        return;
      }
      const body = parsed.data;

      if (!req.file) {
        res.status(400).json({ error: "Student photo is required" });
        return;
      }

      const cert = await prisma.certificate.findUnique({
        where: { claimSessionId: sessionId },
      });
      if (!cert || cert.claimedAt || cert.status !== CertificateStatus.PENDING) {
        res.status(410).json({ error: "Claim link invalid or already used" });
        return;
      }
      if (cert.claimExpiresAt && cert.claimExpiresAt.getTime() < Date.now()) {
        res.status(410).json({ error: "Claim link expired" });
        return;
      }

      const email = body.email.toLowerCase();
      if (!cert.inviteEmail || !emailsEqual(email, cert.inviteEmail)) {
        res.status(400).json({
          error: "Unable to verify this request. Check the email address and try again.",
        });
        return;
      }

      const phone = parsePhoneNumberFromString(body.phone, "NG");
      if (!phone || !phone.isValid()) {
        res.status(400).json({ error: "Invalid phone number" });
        return;
      }

      const otp = await verifyEmailOtp({
        email,
        purpose: "cert_claim",
        code: body.otpCode,
        sessionId,
      });
      if (!otp.ok) {
        res.status(400).json({ error: otp.error });
        return;
      }

      const stored = await compressAndStoreStudentPhoto(req.file.path, uploadDir);
      const photoUrl = stored.publicPath;
      const claimedAt = new Date();

      const result = await prisma.$transaction(async (tx) => {
        const fresh = await tx.certificate.findUnique({
          where: { claimSessionId: sessionId },
        });
        if (!fresh || fresh.claimedAt || fresh.status !== CertificateStatus.PENDING) {
          throw new Error("LINK_INVALID");
        }

        const person = await tx.person.upsert({
          where: { email },
          create: {
            name: body.fullName.trim(),
            email,
            phone: phone.format("E.164"),
          },
          update: {
            name: body.fullName.trim(),
            phone: phone.format("E.164"),
          },
        });

        const publicId = await nextPublicId(tx);

        const updated = await tx.certificate.update({
          where: { id: fresh.id },
          data: {
            personId: person.id,
            publicId,
            photoUrl,
            claimedAt,
            status: CertificateStatus.VALID,
            claimExpiresAt: claimedAt,
          },
        });

        await tx.certificatePublic.create({
          data: {
            publicId,
            certificateId: updated.id,
            displayName: body.fullName.trim(),
            course: updated.course,
            type: updated.type,
            issueDate: updated.issueDate,
            status: CertificateStatus.VALID,
            photoUrl,
          },
        });

        return {
          publicId,
          certificateId: updated.id,
          course: updated.course,
          type: updated.type,
          issueDate: updated.issueDate,
        };
      });

      const pdf = await buildCertificatePdf({
        publicId: result.publicId,
        displayName: body.fullName.trim(),
        course: result.course,
        type: result.type,
        issueDate: result.issueDate,
        status: "VALID",
        photoPath: stored.diskPath,
        photoUrl: stored.publicPath.startsWith("http") ? stored.publicPath : undefined,
      });

      await prisma.certificate.update({
        where: { id: result.certificateId },
        data: { pdfUrl: pdf.publicUrl },
      });

      res.status(201).json({
        ok: true,
        publicId: result.publicId,
        publicUrl: `${env.PUBLIC_SITE_URL}/verify/${result.publicId}`,
        pdfUrl: pdf.publicUrl,
      });
    } catch (err) {
      console.error("[cert.claim]", err);
      if (err instanceof Error && err.message === "LINK_INVALID") {
        res.status(410).json({ error: "Claim link invalid or already used" });
        return;
      }
      res.status(500).json({ error: "Failed to publish certificate" });
    }
  },
);

certificatesRouter.post(
  "/ops/certificates/:publicId/revoke",
  authLimiter,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const publicId = String(req.params.publicId ?? "");
    const cert = await prisma.certificate.findUnique({ where: { publicId } });
    if (!cert) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }

    await prisma.$transaction([
      prisma.certificate.update({
        where: { id: cert.id },
        data: { status: CertificateStatus.REVOKED },
      }),
      prisma.certificatePublic.update({
        where: { publicId },
        data: { status: CertificateStatus.REVOKED },
      }),
    ]);

    await writeAudit({
      adminEmail: req.adminEmail!,
      action: "certificate.revoke",
      targetId: cert.id,
      metadata: { publicId },
    });

    res.json({ ok: true, publicId, status: "REVOKED" });
  },
);
