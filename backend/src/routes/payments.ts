import { Router } from "express";
import { PaymentKind, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authLimiter, publicLookupLimiter } from "../middleware/security.js";
import {
  createBachsCheckout,
  getBachsCheckout,
  isBachsConfigured,
  verifyBachsWebhookSignature,
} from "../lib/bachs.js";
import {
  PAYMENT_AMOUNTS_USD,
  fulfillPaymentOrder,
  newPaymentReference,
  paymentLabel,
} from "../lib/payments.js";
import { isValidPublicId } from "../lib/publicId.js";

export const paymentsRouter = Router();

function siteBase(): string {
  return (env.PUBLIC_SITE_URL || env.APP_URL || "https://www.digital26.online").replace(
    /\/$/,
    "",
  );
}

const publicCheckoutSchema = z.object({
  kind: z.enum(["CERTIFICATE", "AGREEMENT"]),
  publicId: z.string().min(4).max(32),
  email: z.string().email().max(200),
  name: z.string().min(2).max(120).optional(),
});

paymentsRouter.post(
  "/public/payments/checkout",
  publicLookupLimiter,
  async (req, res) => {
    try {
      if (!isBachsConfigured()) {
        res.status(503).json({
          error: "Payments are not configured yet. Set BACHS_API_KEY on the server.",
        });
        return;
      }

      const parsed = publicCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payment request" });
        return;
      }

      const { kind, email } = parsed.data;
      const publicId = parsed.data.publicId.trim();
      if (!isValidPublicId(publicId)) {
        res.status(400).json({ error: "Invalid public ID" });
        return;
      }

      if (kind === "CERTIFICATE") {
        const cert = await prisma.certificate.findUnique({
          where: { publicId },
          select: { viewPaidAt: true, status: true },
        });
        if (!cert || cert.status !== "VALID") {
          res.status(404).json({ error: "Certificate not found" });
          return;
        }
        if (cert.viewPaidAt) {
          res.json({ ok: true, alreadyPaid: true });
          return;
        }
      } else {
        const agr = await prisma.agreement.findUnique({
          where: { publicId },
          select: { viewPaidAt: true, consumedAt: true },
        });
        if (!agr || !agr.consumedAt) {
          res.status(404).json({ error: "Agreement not found" });
          return;
        }
        if (agr.viewPaidAt) {
          res.json({ ok: true, alreadyPaid: true });
          return;
        }
      }

      const amountUsd = PAYMENT_AMOUNTS_USD[kind];
      const reference = newPaymentReference(kind as PaymentKind);
      const successPath =
        kind === "CERTIFICATE"
          ? `/verify/${encodeURIComponent(publicId)}`
          : `/check-agreement/${encodeURIComponent(publicId)}`;

      const order = await prisma.paymentOrder.create({
        data: {
          kind: kind as PaymentKind,
          status: PaymentStatus.PENDING,
          amountUsd,
          reference,
          customerEmail: email.toLowerCase(),
          publicId,
          metadata: { label: paymentLabel(kind as PaymentKind) },
        },
      });

      const session = await createBachsCheckout({
        amountUsd,
        customerEmail: email.toLowerCase(),
        customerName: parsed.data.name?.trim() || email.split("@")[0] || "Customer",
        successUrl: `${siteBase()}${successPath}?paid=1`,
        cancelUrl: `${siteBase()}${successPath}?cancelled=1`,
        reference,
        metadata: {
          kind,
          reference,
          public_id: publicId,
          order_id: order.id,
        },
      });

      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { checkoutId: session.checkout_id },
      });

      res.status(201).json({
        ok: true,
        checkoutId: session.checkout_id,
        checkoutUrl: session.checkout_url,
        amountUsd,
        label: paymentLabel(kind as PaymentKind),
      });
    } catch (err) {
      console.error("[payments.public.checkout]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to start checkout",
      });
    }
  },
);

paymentsRouter.get(
  "/student/payments/status",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
        select: {
          id: true,
          status: true,
          registrationPaidAt: true,
          fullName: true,
          programme: true,
          classMode: true,
        },
      });

      if (!profile) {
        res.status(404).json({ error: "Submit your application first" });
        return;
      }

      const latest = await prisma.paymentOrder.findFirst({
        where: {
          profileId: profile.id,
          kind: PaymentKind.REGISTRATION,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          amountUsd: true,
          reference: true,
          checkoutId: true,
          paidAt: true,
          createdAt: true,
        },
      });

      const registrationPaid = Boolean(profile.registrationPaidAt);
      const adminApproved = profile.status === "APPROVED";
      const rejected = profile.status === "REJECTED";
      const paymentsEnabled = isBachsConfigured();

      res.json({
        kind: "REGISTRATION",
        amountUsd: PAYMENT_AMOUNTS_USD.REGISTRATION,
        label: paymentLabel(PaymentKind.REGISTRATION),
        registrationPaid,
        registrationPaidAt: profile.registrationPaidAt,
        adminApproved,
        rejected,
        studentStatus: profile.status,
        paymentsEnabled,
        canPay: paymentsEnabled && !registrationPaid && !rejected,
        fullyActive: adminApproved && registrationPaid,
        profile: {
          fullName: profile.fullName,
          programme: profile.programme,
          classMode: profile.classMode,
        },
        latestOrder: latest,
      });
    } catch (err) {
      console.error("[payments.status]", err);
      res.status(500).json({ error: "Failed to load payment status" });
    }
  },
);

paymentsRouter.post(
  "/student/payments/registration",
  authLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      if (!isBachsConfigured()) {
        res.status(503).json({
          error: "Payments are not configured yet. Set BACHS_API_KEY on the server.",
        });
        return;
      }

      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
        include: { user: { select: { email: true, name: true } } },
      });
      if (!profile) {
        res.status(404).json({ error: "Submit your application first" });
        return;
      }
      if (profile.status === "REJECTED") {
        res.status(403).json({ error: "Rejected applications cannot pay registration" });
        return;
      }
      if (profile.registrationPaidAt) {
        res.json({ ok: true, alreadyPaid: true });
        return;
      }

      const email = (req.userEmail || profile.user.email || "").toLowerCase();
      if (!email) {
        res.status(400).json({ error: "Email required for payment" });
        return;
      }

      // Reuse a recent open checkout for this student (prevents checkout spam).
      const recentOpen = await prisma.paymentOrder.findFirst({
        where: {
          profileId: profile.id,
          kind: PaymentKind.REGISTRATION,
          status: PaymentStatus.PENDING,
          checkoutId: { not: null },
          createdAt: { gte: new Date(Date.now() - 45 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recentOpen?.checkoutId) {
        try {
          const remote = await getBachsCheckout(recentOpen.checkoutId);
          const status = String(remote.status || "").toUpperCase();
          if (status === "OPEN" && remote.checkout_url) {
            res.json({
              ok: true,
              reused: true,
              checkoutId: recentOpen.checkoutId,
              checkoutUrl: remote.checkout_url,
              amountUsd: recentOpen.amountUsd,
              label: paymentLabel(PaymentKind.REGISTRATION),
            });
            return;
          }
          if (status === "COMPLETED" || status === "PAID" || status === "SUCCEEDED") {
            await fulfillPaymentOrder({
              checkoutId: recentOpen.checkoutId,
              reference: recentOpen.reference,
            });
            res.json({ ok: true, alreadyPaid: true });
            return;
          }
        } catch {
          /* create a fresh checkout below */
        }
      }

      const amountUsd = PAYMENT_AMOUNTS_USD.REGISTRATION;
      const reference = newPaymentReference(PaymentKind.REGISTRATION);

      const order = await prisma.paymentOrder.create({
        data: {
          kind: PaymentKind.REGISTRATION,
          status: PaymentStatus.PENDING,
          amountUsd,
          reference,
          customerEmail: email,
          userId: req.userId!,
          profileId: profile.id,
          metadata: { label: paymentLabel(PaymentKind.REGISTRATION) },
        },
      });

      const session = await createBachsCheckout({
        amountUsd,
        customerEmail: email,
        customerName: profile.fullName || profile.user.name || email.split("@")[0] || "Student",
        successUrl: `${siteBase()}/dashboard/payment?paid=1`,
        cancelUrl: `${siteBase()}/dashboard/payment?cancelled=1`,
        reference,
        metadata: {
          kind: "REGISTRATION",
          reference,
          order_id: order.id,
          profile_id: profile.id,
          user_id: req.userId!,
        },
      });

      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { checkoutId: session.checkout_id },
      });

      res.status(201).json({
        ok: true,
        checkoutId: session.checkout_id,
        checkoutUrl: session.checkout_url,
        amountUsd,
        label: paymentLabel(PaymentKind.REGISTRATION),
      });
    } catch (err) {
      console.error("[payments.registration]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to start checkout",
      });
    }
  },
);

/** Authenticated sync — only the owning student can confirm their registration checkout. */
paymentsRouter.post(
  "/student/payments/sync",
  authLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const checkoutId =
        typeof req.body?.checkout_id === "string" ? req.body.checkout_id.trim() : "";
      if (!checkoutId) {
        res.status(400).json({ error: "checkout_id required" });
        return;
      }

      const order = await prisma.paymentOrder.findFirst({
        where: {
          checkoutId,
          userId: req.userId!,
          kind: PaymentKind.REGISTRATION,
        },
      });
      if (!order) {
        res.status(404).json({ error: "Payment not found for this account" });
        return;
      }

      if (order.status !== PaymentStatus.PAID && isBachsConfigured()) {
        try {
          const remote = await getBachsCheckout(checkoutId);
          const status = String(remote.status || "").toUpperCase();
          if (status === "COMPLETED" || status === "PAID" || status === "SUCCEEDED") {
            await fulfillPaymentOrder({
              checkoutId,
              reference: order.reference,
            });
          }
        } catch (err) {
          console.warn("[payments.student.sync.remote]", err);
        }
      }

      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
        select: { registrationPaidAt: true, status: true },
      });
      const fresh = await prisma.paymentOrder.findUnique({
        where: { id: order.id },
        select: { status: true, paidAt: true },
      });

      res.json({
        ok: true,
        status: fresh?.status ?? order.status,
        paidAt: fresh?.paidAt ?? null,
        registrationPaid: Boolean(profile?.registrationPaidAt),
        fullyActive:
          profile?.status === "APPROVED" && Boolean(profile.registrationPaidAt),
      });
    } catch (err) {
      console.error("[payments.student.sync]", err);
      res.status(500).json({ error: "Failed to sync payment" });
    }
  },
);

paymentsRouter.get("/public/payments/sync", publicLookupLimiter, async (req, res) => {
  try {
    const checkoutId =
      typeof req.query.checkout_id === "string" ? req.query.checkout_id.trim() : "";
    if (!checkoutId) {
      res.status(400).json({ error: "checkout_id required" });
      return;
    }

    const local = await prisma.paymentOrder.findUnique({
      where: { checkoutId },
      select: {
        id: true,
        status: true,
        kind: true,
        publicId: true,
        amountUsd: true,
      },
    });
    if (!local) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    if (local.status !== PaymentStatus.PAID && isBachsConfigured()) {
      try {
        const remote = await getBachsCheckout(checkoutId);
        const status = String(remote.status || "").toUpperCase();
        if (status === "COMPLETED" || status === "PAID" || status === "SUCCEEDED") {
          await fulfillPaymentOrder({
            checkoutId,
            reference: remote.reference,
          });
        }
      } catch (err) {
        console.warn("[payments.sync.remote]", err);
      }
    }

    const fresh = await prisma.paymentOrder.findUnique({
      where: { checkoutId },
      select: {
        status: true,
        kind: true,
        publicId: true,
        amountUsd: true,
        paidAt: true,
      },
    });

    res.json({
      ok: true,
      status: fresh?.status ?? local.status,
      kind: fresh?.kind ?? local.kind,
      publicId: fresh?.publicId ?? local.publicId,
      amountUsd: fresh?.amountUsd ?? local.amountUsd,
      paidAt: fresh?.paidAt ?? null,
    });
  } catch (err) {
    console.error("[payments.sync]", err);
    res.status(500).json({ error: "Failed to sync payment" });
  }
});

export async function bachsWebhookHandler(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));

    if (env.BACHS_WEBHOOK_SECRET?.trim()) {
      const valid = verifyBachsWebhookSignature({
        rawBody,
        timestampHeader: req.header("X-Bachs-Timestamp") || undefined,
        signatureHeader: req.header("X-Bachs-Signature") || undefined,
      });
      if (!valid) {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    } else if (env.isProd) {
      console.warn("[payments.webhook] BACHS_WEBHOOK_SECRET not set — rejecting in production");
      res.status(503).json({ error: "Webhook secret not configured" });
      return;
    }

    const event = JSON.parse(rawBody.toString("utf8")) as {
      id?: string;
      type?: string;
      data?: {
        checkout_id?: string | null;
        reference?: string | null;
        charge_id?: string | null;
        status?: string;
        metadata?: Record<string, string>;
      };
    };

    if (event.type === "collection.succeeded") {
      await fulfillPaymentOrder({
        checkoutId: event.data?.checkout_id,
        reference: event.data?.reference || event.data?.metadata?.reference,
        chargeId: event.data?.charge_id,
        eventId: event.id,
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[payments.webhook]", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
