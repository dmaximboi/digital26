import { Router } from "express";
import { z } from "zod";
import { DealType } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import {
  generatePasskey,
  generateSessionId,
  hashPasskey,
  verifyPasskey,
  encryptField,
} from "../lib/crypto.js";
import { sendOtpEmail, sendPasskeyEmail } from "../lib/mail.js";
import { issueEmailOtp, verifyEmailOtp } from "../lib/otp.js";
import { nextPublicId } from "../lib/publicId.js";
import { emailsEqual } from "../lib/safeEqual.js";
import { AGREEMENT_TERMS } from "../lib/terms.js";
import { writeAudit } from "../lib/audit.js";
import { buildAgreementPdf } from "../lib/pdf.js";
import {
  requireAdmin,
} from "../middleware/requireAdmin.js";
import { authLimiter } from "../middleware/security.js";
import type { AuthedRequest } from "../middleware/adminAuth.js";

const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PASSKEY_ATTEMPTS = 5;
const LOCK_MS = 30 * 60 * 1000;

export const agreementsRouter = Router();

const createSchema = z.object({
  clientEmail: z.string().email(),
  clientName: z.string().min(2).max(120).optional(),
  clientPhone: z.string().max(32).optional(),
});


agreementsRouter.post(
  "/ops/agreements",
  authLimiter,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const data = parsed.data;
      const email = data.clientEmail.toLowerCase();
      const sessionId = generateSessionId();
      const passkey = generatePasskey(18);
      const passkeyHash = hashPasskey(passkey);
      const linkExpiresAt = new Date(Date.now() + LINK_TTL_MS);

      const person = await prisma.person.upsert({
        where: { email },
        create: {
          name: data.clientName?.trim() || email.split("@")[0] || "Client",
          email,
          phone: data.clientPhone,
        },
        update: {
          ...(data.clientName ? { name: data.clientName.trim() } : {}),
          ...(data.clientPhone ? { phone: data.clientPhone } : {}),
        },
      });

      const agreement = await prisma.agreement.create({
        data: {
          personId: person.id,
          dealType: DealType.OTHER,
          otherDealText: null,
          termsSnapshot: AGREEMENT_TERMS,
          passkeyHash,
          sessionId,
          linkExpiresAt,
        },
      });

      const link = `${env.APP_URL}/sign/${sessionId}`;
      const publicPreviewNote = `${env.PUBLIC_SITE_URL}/a/{publicId}`;
      const mail = await sendPasskeyEmail({
        to: email,
        passkey,
        link,
        expiresAt: linkExpiresAt,
      });

      try {
        await writeAudit({
          adminEmail: req.adminEmail!,
          action: "agreement.create",
          targetId: agreement.id,
          metadata: {
            sessionId,
            clientEmail: email,
            linkExpiresAt: linkExpiresAt.toISOString(),
            emailDelivered: mail.delivered,
          },
        });
      } catch (err) {
        console.warn("[agreement.create] audit failed:", err);
      }

      res.status(201).json({
        id: agreement.id,
        sessionId,
        link,
        passkey,
        emailDelivered: mail.delivered,
        linkExpiresAt,
        hoursValid: 24,
        afterSignPublicPattern: publicPreviewNote,
        message: mail.delivered
          ? "Agreement letter link created (valid 24 hours). Passkey emailed to client."
          : "Agreement letter link created, but email could not be sent. Copy the link and passkey below and share them manually.",
      });
    } catch (err) {
      console.error("[agreement.create]", err);
      res.status(500).json({ error: "Failed to create agreement" });
    }
  },
);


agreementsRouter.get("/sign/:sessionId/status", async (req, res) => {
  const sessionId = String(req.params.sessionId ?? "");
  const agreement = await prisma.agreement.findUnique({
    where: { sessionId },
    select: {
      linkExpiresAt: true,
      consumedAt: true,
      lockedUntil: true,
      dealType: true,
      otherDealText: true,
      person: { select: { name: true } },
    },
  });

  if (!agreement) {
    res.status(404).json({ status: "invalid", error: "Link not found" });
    return;
  }

  const now = Date.now();
  if (agreement.consumedAt) {
    res.json({ status: "consumed" });
    return;
  }
  if (agreement.linkExpiresAt.getTime() < now) {
    res.json({ status: "expired" });
    return;
  }
  if (agreement.lockedUntil && agreement.lockedUntil.getTime() > now) {
    res.json({ status: "locked", lockedUntil: agreement.lockedUntil });
    return;
  }

  res.json({
    status: "pending_passkey",
    dealType: agreement.dealType,
    otherDealText: agreement.otherDealText,
    clientNameHint: agreement.person.name,
    expiresAt: agreement.linkExpiresAt,
  });
});

const unlockSchema = z.object({
  passkey: z.string().min(8).max(128),
});


agreementsRouter.post(
  "/sign/:sessionId/unlock",
  authLimiter,
  async (req, res) => {
    const sessionId = String(req.params.sessionId ?? "");
    const parsed = unlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Passkey required" });
      return;
    }

    const agreement = await prisma.agreement.findUnique({
      where: { sessionId },
      include: { person: true },
    });

    if (!agreement) {
      res.status(404).json({ error: "invalid", message: "Link not found" });
      return;
    }

    const now = Date.now();
    if (agreement.consumedAt) {
      res.status(410).json({ error: "consumed", message: "This link has already been used" });
      return;
    }
    if (agreement.linkExpiresAt.getTime() < now) {
      res.status(410).json({ error: "expired", message: "This link has expired" });
      return;
    }
    if (agreement.lockedUntil && agreement.lockedUntil.getTime() > now) {
      res.status(423).json({
        error: "locked",
        message: "Too many attempts. Try again later.",
        lockedUntil: agreement.lockedUntil,
      });
      return;
    }

    const ok = verifyPasskey(parsed.data.passkey, agreement.passkeyHash);
    if (!ok) {
      const attempts = agreement.passkeyAttempts + 1;
      const lock = attempts >= MAX_PASSKEY_ATTEMPTS;
      await prisma.agreement.update({
        where: { id: agreement.id },
        data: {
          passkeyAttempts: attempts,
          ...(lock ? { lockedUntil: new Date(now + LOCK_MS) } : {}),
        },
      });
      res.status(401).json({
        error: "invalid_passkey",
        message: "Incorrect passkey",
      });
      return;
    }

    
    await prisma.agreement.update({
      where: { id: agreement.id },
      data: { passkeyAttempts: 0, lockedUntil: null },
    });

    res.json({
      status: "unlocked",
      sessionId,
      dealType: agreement.dealType,
      otherDealText: agreement.otherDealText,
      terms: agreement.termsSnapshot,
      person: {
        name: agreement.person.name,
        
      },
      emailLocked: true,
      expiresAt: agreement.linkExpiresAt,
    });
  },
);

const otpRequestSchema = z.object({
  email: z.string().email(),
  passkey: z.string().min(8),
});

agreementsRouter.post(
  "/sign/:sessionId/otp/request",
  authLimiter,
  async (req, res) => {
    const sessionId = String(req.params.sessionId ?? "");
    const parsed = otpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const agreement = await loadActiveAgreement(sessionId);
    if (!agreement.ok) {
      res.status(agreement.status).json({ error: agreement.error });
      return;
    }

    if (!verifyPasskey(parsed.data.passkey, agreement.data.passkeyHash)) {
      res.status(401).json({ error: "Passkey required" });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const locked = agreement.data.person.email?.toLowerCase();
    if (!locked) {
      res.status(400).json({
        error: "This agreement invite is misconfigured. Request a new link.",
      });
      return;
    }
    if (!emailsEqual(email, locked)) {
      res.status(400).json({
        error: "Unable to verify this request. Check the email address and try again.",
      });
      return;
    }

    const issued = await issueEmailOtp({
      email,
      purpose: "agreement_email",
      sessionId,
    });
    if ("error" in issued) {
      res.status(429).json({ error: issued.error });
      return;
    }
    await sendOtpEmail({ to: email, code: issued.code });

    res.json({
      ok: true,
      message: "Verification code sent",
    });
  },
);

const submitSchema = z.object({
  passkey: z.string().min(8),
  fullName: z.string().min(2).max(120),
  dealTag: z.string().min(2).max(50),
  phone: z.string().min(5).max(32),
  phoneCountry: z.string().min(2).max(2).default("NG"),
  email: z.string().email(),
  otpCode: z.string().regex(/^\d{6}$/),
  signatureName: z.string().min(2).max(120),
  nin: z.string().min(8).max(20).optional(),
});

agreementsRouter.post(
  "/sign/:sessionId/submit",
  authLimiter,
  async (req, res) => {
    const sessionId = String(req.params.sessionId ?? "");
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const body = parsed.data;
    const dealTag = body.dealTag.trim();

    const agreement = await loadActiveAgreement(sessionId);
    if (!agreement.ok) {
      res.status(agreement.status).json({ error: agreement.error });
      return;
    }

    if (!verifyPasskey(body.passkey, agreement.data.passkeyHash)) {
      res.status(401).json({ error: "Invalid passkey" });
      return;
    }

    const lockedEmail = agreement.data.person.email?.toLowerCase();
    const email = body.email.toLowerCase();
    if (!lockedEmail || !emailsEqual(email, lockedEmail)) {
      res.status(400).json({
        error: "Unable to verify this request. Check the email address and try again.",
      });
      return;
    }

    const phone = parsePhoneNumberFromString(body.phone, body.phoneCountry as "NG");
    if (!phone || !phone.isValid()) {
      res.status(400).json({ error: "Invalid phone number for selected country" });
      return;
    }

    const otp = await verifyEmailOtp({
      email,
      purpose: "agreement_email",
      code: body.otpCode,
      sessionId,
    });
    if (!otp.ok) {
      res.status(400).json({ error: otp.error });
      return;
    }

    const requestingIp =
      (typeof req.headers["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
        : undefined) ||
      req.socket.remoteAddress ||
      null;

    const signedAt = new Date();
    let ninEncrypted: string | null = null;
    if (body.nin) {
      ninEncrypted = encryptField(body.nin.trim());
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const fresh = await tx.agreement.findUnique({ where: { sessionId } });
        if (!fresh || fresh.consumedAt || fresh.linkExpiresAt.getTime() < Date.now()) {
          throw new Error("LINK_INVALID");
        }

        const publicId = await nextPublicId(tx);

        await tx.person.update({
          where: { id: fresh.personId },
          data: {
            name: body.fullName.trim(),
            email,
            phone: phone.format("E.164"),
          },
        });

        const updated = await tx.agreement.update({
          where: { id: fresh.id },
          data: {
            dealType: DealType.OTHER,
            otherDealText: dealTag,
            signatureName: body.signatureName.trim(),
            signedAt,
            consumedAt: signedAt,
            publicId,
            requestingIp,
            ninEncrypted,
            passkeyHash: hashPasskey(generatePasskey(24)),
          },
        });

        await tx.agreementPublic.create({
          data: {
            publicId,
            agreementId: updated.id,
            displayName: body.fullName.trim(),
            dealType: DealType.OTHER,
            dealTag,
            signedAt,
            signatureName: body.signatureName.trim(),
          },
        });

        return { publicId, agreementId: updated.id, termsSnapshot: fresh.termsSnapshot };
      });

      const pdf = await buildAgreementPdf({
        publicId: result.publicId,
        displayName: body.fullName.trim(),
        dealType: DealType.OTHER,
        dealTag,
        signatureName: body.signatureName.trim(),
        signedAt,
        terms: result.termsSnapshot,
      });

      await prisma.agreement.update({
        where: { id: result.agreementId },
        data: { pdfUrl: pdf.publicUrl },
      });

      res.status(201).json({
        ok: true,
        publicId: result.publicId,
        publicUrl: `${env.PUBLIC_SITE_URL}/a/${result.publicId}`,
        pdfUrl: pdf.publicUrl,
        signedAt,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "LINK_INVALID") {
        res.status(410).json({ error: "Link expired or already used" });
        return;
      }
      throw err;
    }
  },
);

async function loadActiveAgreement(sessionId: string) {
  const data = await prisma.agreement.findUnique({
    where: { sessionId },
    include: { person: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!data) {
    return { ok: false as const, status: 404, error: "Link not found" };
  }
  if (data.consumedAt) {
    return { ok: false as const, status: 410, error: "consumed" };
  }
  if (data.linkExpiresAt.getTime() < Date.now()) {
    return { ok: false as const, status: 410, error: "expired" };
  }
  if (data.lockedUntil && data.lockedUntil.getTime() > Date.now()) {
    return { ok: false as const, status: 423, error: "locked" };
  }
  return { ok: true as const, data };
}
