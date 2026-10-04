import { Router } from "express";
import { PaymentKind, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { publicLookupLimiter } from "../middleware/security.js";
import {
  createBachsCheckout,
  getBachsCheckout,
  isBachsConfigured,
  isSuccessfulCheckout,
} from "../lib/bachs.js";
import {
  DICTIONARY_PACK_AMOUNT_USD,
  DICTIONARY_PACK_PUBLIC_ID,
  newPaymentReference,
  verifyAndFulfillOrder,
} from "../lib/payments.js";

export const DICTIONARY_PUBLIC_ID = DICTIONARY_PACK_PUBLIC_ID;
export const DICTIONARY_AMOUNT_USD = DICTIONARY_PACK_AMOUNT_USD;
export const DICTIONARY_LABEL = "Tech dictionary pack";

export const dictionaryRouter = Router();

function siteBase(): string {
  return (env.PUBLIC_SITE_URL || env.APP_URL || "https://www.digital26.online").replace(
    /\/$/,
    "",
  );
}

const checkoutSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(2).max(120).optional(),
});

async function dictionaryPaid(opts: { email?: string; checkoutId?: string }): Promise<boolean> {
  const checkoutId = opts.checkoutId?.trim() || "";
  const email = opts.email?.trim().toLowerCase() || "";
  if (checkoutId) {
    const byCheckout = await prisma.paymentOrder.findUnique({
      where: { checkoutId },
      select: { status: true, kind: true, publicId: true },
    });
    if (
      byCheckout?.status === PaymentStatus.PAID &&
      byCheckout.kind === PaymentKind.LIBRARY &&
      byCheckout.publicId === DICTIONARY_PUBLIC_ID
    ) {
      return true;
    }
  }
  if (email) {
    const byEmail = await prisma.paymentOrder.findFirst({
      where: {
        kind: PaymentKind.LIBRARY,
        publicId: DICTIONARY_PUBLIC_ID,
        status: PaymentStatus.PAID,
        customerEmail: email,
      },
      select: { id: true },
    });
    return Boolean(byEmail);
  }
  return false;
}

dictionaryRouter.get("/public/dictionary/meta", (_req, res) => {
  const site = siteBase();
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    publicId: DICTIONARY_PUBLIC_ID,
    amountUsd: DICTIONARY_AMOUNT_USD,
    label: DICTIONARY_LABEL,
    paymentsEnabled: isBachsConfigured(),
    public: true,
    freeToRead: true,
    url: `${site}/dictionary`,
    aliases: [
      `${site}/glossary`,
      `${site}/tech-dictionary`,
      `${site}/tech-terms`,
      `${site}/terminology`,
    ],
    markdown: `${site}/dictionary.md`,
    glossaryHtml: `${site}/glossary.html`,
  });
});

dictionaryRouter.get("/public/dictionary/access", publicLookupLimiter, async (req, res) => {
  try {
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
    const checkoutId =
      typeof req.query.checkout_id === "string" ? req.query.checkout_id.trim() : "";
    if (checkoutId) {
      await verifyAndFulfillOrder({ checkoutId });
    }
    const paid = await dictionaryPaid({ email, checkoutId });
    res.json({
      ok: true,
      paid,
      publicId: DICTIONARY_PUBLIC_ID,
      amountUsd: DICTIONARY_AMOUNT_USD,
    });
  } catch (err) {
    console.error("[dictionary.access]", err);
    res.status(500).json({ error: "Could not check dictionary access" });
  }
});

dictionaryRouter.post("/public/dictionary/checkout", publicLookupLimiter, async (req, res) => {
  try {
    if (!isBachsConfigured()) {
      res.status(503).json({
        error: "Payments are not configured yet. Set BACHS_API_KEY on the server.",
      });
      return;
    }

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid email for the receipt" });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const already = await dictionaryPaid({ email });
    if (already) {
      res.json({
        ok: true,
        alreadyPaid: true,
        paid: true,
        publicId: DICTIONARY_PUBLIC_ID,
      });
      return;
    }

    const recentOpen = await prisma.paymentOrder.findFirst({
      where: {
        kind: PaymentKind.LIBRARY,
        publicId: DICTIONARY_PUBLIC_ID,
        customerEmail: email,
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
          res.json({
            ok: true,
            alreadyPaid: true,
            paid: true,
            checkoutId: recentOpen.checkoutId,
          });
          return;
        }
        if (String(remote.status).toUpperCase() === "OPEN" && remote.checkout_url) {
          res.json({
            ok: true,
            reused: true,
            checkoutId: recentOpen.checkoutId,
            checkoutUrl: remote.checkout_url,
            amountUsd: recentOpen.amountUsd,
            label: DICTIONARY_LABEL,
          });
          return;
        }
      } catch {
        /* create fresh */
      }
    }

    const reference = newPaymentReference(PaymentKind.LIBRARY);
    const order = await prisma.paymentOrder.create({
      data: {
        kind: PaymentKind.LIBRARY,
        status: PaymentStatus.PENDING,
        amountUsd: DICTIONARY_AMOUNT_USD,
        reference,
        customerEmail: email,
        publicId: DICTIONARY_PUBLIC_ID,
        metadata: { label: DICTIONARY_LABEL, product: "dictionary" },
      },
    });

    const session = await createBachsCheckout({
      amountUsd: DICTIONARY_AMOUNT_USD,
      customerEmail: email,
      customerName: parsed.data.name?.trim() || email.split("@")[0] || "Customer",
      successUrl: `${siteBase()}/dictionary`,
      cancelUrl: `${siteBase()}/dictionary`,
      reference,
      metadata: {
        kind: "DICTIONARY",
        reference,
        public_id: DICTIONARY_PUBLIC_ID,
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
      amountUsd: DICTIONARY_AMOUNT_USD,
      label: DICTIONARY_LABEL,
    });
  } catch (err) {
    console.error("[dictionary.checkout]", err);
    res.status(500).json({ error: "Could not open dictionary checkout" });
  }
});
