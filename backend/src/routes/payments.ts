import { Router } from "express";
import { PaymentKind, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { requireAuth, requireAdmin, requireAdminWrite } from "../middleware/requireAuth.js";
import { authLimiter, publicLookupLimiter } from "../middleware/security.js";
import {
  createBachsCheckout,
  getBachsCheckout,
  isBachsConfigured,
  isSuccessfulCheckout,
  verifyBachsWebhookSignature,
} from "../lib/bachs.js";
import {
  PAYMENT_AMOUNTS_USD,
  reconcileProfilePayments,
  newPaymentReference,
  paymentLabel,
  verifyAndFulfillOrder,
} from "../lib/payments.js";
import { isValidPublicId } from "../lib/publicId.js";
import { writeAudit } from "../lib/audit.js";

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
      // No query string — Bachs appends ?checkout_id= itself.
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
        successUrl: `${siteBase()}${successPath}`,
        cancelUrl: `${siteBase()}${successPath}`,
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

      // Always try to recover stuck payments when status is loaded.
      let reconcile: Awaited<ReturnType<typeof reconcileProfilePayments>> | null = null;
      if (isBachsConfigured() && !profile.registrationPaidAt) {
        try {
          reconcile = await reconcileProfilePayments(profile.id);
        } catch (err) {
          console.warn("[payments.status.reconcile]", err);
        }
      } else if (profile.registrationPaidAt) {
        // no-op
      } else {
        // Even without Bachs, repair PAID orders with null registrationPaidAt
        const paidOrder = await prisma.paymentOrder.findFirst({
          where: {
            profileId: profile.id,
            kind: PaymentKind.REGISTRATION,
            status: PaymentStatus.PAID,
          },
        });
        if (paidOrder) {
          await prisma.studentProfile.update({
            where: { id: profile.id },
            data: { registrationPaidAt: paidOrder.paidAt || new Date() },
          });
        }
      }

      const fresh = await prisma.studentProfile.findUnique({
        where: { id: profile.id },
        select: {
          status: true,
          registrationPaidAt: true,
          fullName: true,
          programme: true,
          classMode: true,
        },
      });

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
          chargeId: true,
          paidAt: true,
          createdAt: true,
        },
      });

      const registrationPaid = Boolean(fresh?.registrationPaidAt);
      const adminApproved = fresh?.status === "APPROVED";
      const rejected = fresh?.status === "REJECTED";
      const paymentsEnabled = isBachsConfigured();

      res.json({
        kind: "REGISTRATION",
        amountUsd: PAYMENT_AMOUNTS_USD.REGISTRATION,
        label: paymentLabel(PaymentKind.REGISTRATION),
        registrationPaid,
        registrationPaidAt: fresh?.registrationPaidAt ?? null,
        adminApproved,
        rejected,
        studentStatus: fresh?.status ?? profile.status,
        paymentsEnabled,
        canPay: paymentsEnabled && !registrationPaid && !rejected,
        fullyActive: Boolean(adminApproved && registrationPaid),
        profile: {
          fullName: fresh?.fullName ?? profile.fullName,
          programme: fresh?.programme ?? profile.programme,
          classMode: fresh?.classMode ?? profile.classMode,
        },
        latestOrder: latest,
        reconcile,
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

      // Recover first — student may have already paid.
      const recovered = await reconcileProfilePayments(profile.id);
      if (recovered.fulfilled > 0) {
        const again = await prisma.studentProfile.findUnique({
          where: { id: profile.id },
          select: { registrationPaidAt: true },
        });
        if (again?.registrationPaidAt) {
          res.json({ ok: true, alreadyPaid: true, reconcile: recovered });
          return;
        }
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
          if (isSuccessfulCheckout(remote)) {
            await verifyAndFulfillOrder({
              orderId: recentOpen.id,
              checkoutId: recentOpen.checkoutId,
              reference: recentOpen.reference,
              chargeId: remote.charge?.charge_id,
            });
            res.json({ ok: true, alreadyPaid: true });
            return;
          }
          if (String(remote.status).toUpperCase() === "OPEN" && remote.checkout_url) {
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
        } catch {
          /* create fresh */
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
        // Bare path so Bachs can append ?checkout_id= cleanly.
        successUrl: `${siteBase()}/dashboard/payment`,
        cancelUrl: `${siteBase()}/dashboard/payment`,
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

/** Authenticated reconcile — verifies pending orders against Bachs ledger. */
paymentsRouter.post(
  "/student/payments/reconcile",
  authLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
        select: { id: true, registrationPaidAt: true, status: true },
      });
      if (!profile) {
        res.status(404).json({ error: "Submit your application first" });
        return;
      }

      const checkoutId =
        typeof req.body?.checkout_id === "string" ? req.body.checkout_id.trim() : "";

      let direct: Awaited<ReturnType<typeof verifyAndFulfillOrder>> | null = null;
      if (checkoutId) {
        const owned = await prisma.paymentOrder.findFirst({
          where: {
            checkoutId,
            userId: req.userId!,
            kind: PaymentKind.REGISTRATION,
          },
        });
        if (!owned) {
          res.status(404).json({ error: "Payment not found for this account" });
          return;
        }
        direct = await verifyAndFulfillOrder({
          orderId: owned.id,
          checkoutId,
          reference: owned.reference,
          chargeId: owned.chargeId,
        });
      }

      const reconcile = await reconcileProfilePayments(profile.id);
      const fresh = await prisma.studentProfile.findUnique({
        where: { id: profile.id },
        select: { registrationPaidAt: true, status: true },
      });

      res.json({
        ok: true,
        registrationPaid: Boolean(fresh?.registrationPaidAt),
        fullyActive:
          fresh?.status === "APPROVED" && Boolean(fresh.registrationPaidAt),
        direct,
        reconcile,
      });
    } catch (err) {
      console.error("[payments.student.reconcile]", err);
      res.status(500).json({ error: "Failed to reconcile payment" });
    }
  },
);

/** Legacy alias used by older clients. */
paymentsRouter.post(
  "/student/payments/sync",
  authLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
        select: { id: true, status: true },
      });
      if (!profile) {
        res.status(404).json({ error: "Submit your application first" });
        return;
      }

      const checkoutId =
        typeof req.body?.checkout_id === "string" ? req.body.checkout_id.trim() : "";
      if (checkoutId) {
        const owned = await prisma.paymentOrder.findFirst({
          where: { checkoutId, userId: req.userId!, kind: PaymentKind.REGISTRATION },
        });
        if (owned) {
          await verifyAndFulfillOrder({
            orderId: owned.id,
            checkoutId,
            reference: owned.reference,
            chargeId: owned.chargeId,
          });
        }
      }

      const reconcile = await reconcileProfilePayments(profile.id);
      const fresh = await prisma.studentProfile.findUnique({
        where: { id: profile.id },
        select: { registrationPaidAt: true, status: true },
      });

      res.json({
        ok: true,
        status: fresh?.registrationPaidAt ? "PAID" : "PENDING",
        paidAt: fresh?.registrationPaidAt ?? null,
        registrationPaid: Boolean(fresh?.registrationPaidAt),
        fullyActive:
          fresh?.status === "APPROVED" && Boolean(fresh.registrationPaidAt),
        reconcile,
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

    const result = await verifyAndFulfillOrder({ checkoutId });
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
      ok: result.ok,
      reason: result.reason,
      status: fresh?.status ?? null,
      kind: fresh?.kind ?? null,
      publicId: fresh?.publicId ?? null,
      amountUsd: fresh?.amountUsd ?? null,
      paidAt: fresh?.paidAt ?? null,
    });
  } catch (err) {
    console.error("[payments.sync]", err);
    res.status(500).json({ error: "Failed to sync payment" });
  }
});

/** Admin: force reconcile a student's registration against Bachs. */
paymentsRouter.post(
  "/ops/payments/reconcile",
  authLimiter,
  requireAdminWrite,
  async (req: AuthedRequest, res) => {
    try {
      const profileId =
        typeof req.body?.profileId === "string" ? req.body.profileId.trim() : "";
      const checkoutId =
        typeof req.body?.checkoutId === "string" ? req.body.checkoutId.trim() : "";
      const reference =
        typeof req.body?.reference === "string" ? req.body.reference.trim() : "";

      if (!profileId && !checkoutId && !reference) {
        res.status(400).json({ error: "profileId, checkoutId, or reference required" });
        return;
      }

      let result = null;
      if (checkoutId || reference) {
        result = await verifyAndFulfillOrder({ checkoutId, reference });
      }

      let reconcile = null;
      if (profileId) {
        reconcile = await reconcileProfilePayments(profileId);
      } else if (result?.orderId) {
        const order = await prisma.paymentOrder.findUnique({
          where: { id: result.orderId },
          select: { profileId: true },
        });
        if (order?.profileId) {
          reconcile = await reconcileProfilePayments(order.profileId);
        }
      }

      await writeAudit({
        adminEmail: req.userEmail || "admin",
        action: "payments.reconcile",
        targetId: result?.orderId || profileId || checkoutId || reference,
        metadata: { result, reconcile },
      });

      res.json({ ok: true, result, reconcile });
    } catch (err) {
      console.error("[payments.ops.reconcile]", err);
      res.status(500).json({ error: "Reconcile failed" });
    }
  },
);

paymentsRouter.get("/ops/payments/pending", requireAdmin, async (_req, res) => {
  try {
    const items = await prisma.paymentOrder.findMany({
      where: {
        kind: PaymentKind.REGISTRATION,
        status: PaymentStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        amountUsd: true,
        reference: true,
        checkoutId: true,
        customerEmail: true,
        profileId: true,
        createdAt: true,
        profile: { select: { fullName: true, status: true, registrationPaidAt: true } },
      },
    });
    res.json({ items });
  } catch (err) {
    console.error("[payments.ops.pending]", err);
    res.status(500).json({ error: "Failed to list pending payments" });
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
        console.error("[payments.webhook] invalid signature");
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
        amount?: string;
        currency?: string;
        metadata?: Record<string, string>;
      };
    };

    console.log("[payments.webhook]", event.type, {
      eventId: event.id,
      checkoutId: event.data?.checkout_id,
      chargeId: event.data?.charge_id,
      reference: event.data?.reference,
    });

    if (
      event.type === "collection.succeeded" ||
      event.type === "checkout.completed"
    ) {
      // Extract IDs only — verify against Bachs API before fulfilling.
      const result = await verifyAndFulfillOrder({
        checkoutId: event.data?.checkout_id,
        reference: event.data?.reference || event.data?.metadata?.reference,
        chargeId: event.data?.charge_id,
        eventId: event.id,
        orderId: event.data?.metadata?.order_id,
      });
      console.log("[payments.webhook.fulfill]", result);
      if (!result.ok && result.reason !== "order_not_found") {
        // 200 so Bachs does not endless-retry signature-valid but business-reject cases;
        // still logged for ops. Retry-worthy lookup failures return 500.
        if (result.reason.includes("lookup_failed")) {
          res.status(500).json({ error: result.reason });
          return;
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[payments.webhook]", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
