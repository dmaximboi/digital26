import { PaymentKind, PaymentStatus, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";
import {
  getBachsCharge,
  getBachsCheckout,
  isBachsConfigured,
  isSuccessfulCharge,
  isSuccessfulCheckout,
  type BachsCheckoutSession,
} from "./bachs.js";

export const PAYMENT_AMOUNTS_USD: Record<PaymentKind, string> = {
  REGISTRATION: "3.00",
  CERTIFICATE: "1.00",
  AGREEMENT: "1.00",
  LIBRARY: "0.00", // actual amount stored per order from LibraryItem.priceUsd
};

export function paymentLabel(kind: PaymentKind): string {
  if (kind === "REGISTRATION") return "Student registration fee";
  if (kind === "CERTIFICATE") return "Certificate access";
  if (kind === "LIBRARY") return "Library resource access";
  return "Agreement letter access";
}

export function newPaymentReference(kind: PaymentKind): string {
  const prefix =
    kind === "REGISTRATION"
      ? "reg"
      : kind === "CERTIFICATE"
        ? "cert"
        : kind === "LIBRARY"
          ? "lib"
          : "agr";
  return `d26_${prefix}_${randomBytes(8).toString("hex")}`;
}

export async function hasLibraryAccess(userId: string, itemId: string): Promise<boolean> {
  const paid = await prisma.paymentOrder.findFirst({
    where: {
      kind: PaymentKind.LIBRARY,
      publicId: itemId,
      userId,
      status: PaymentStatus.PAID,
    },
    select: { id: true },
  });
  return Boolean(paid);
}

function moneyEqual(a: string, b: string): boolean {
  const left = Number.parseFloat(a);
  const right = Number.parseFloat(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) < 0.009;
}

async function repairRegistrationPaid(profileId: string, paidAt: Date): Promise<void> {
  await prisma.studentProfile.updateMany({
    where: { id: profileId, registrationPaidAt: null },
    data: { registrationPaidAt: paidAt },
  });
}

async function applyFulfillmentSideEffects(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    kind: PaymentKind;
    profileId: string | null;
    publicId: string | null;
  },
  paidAt: Date,
): Promise<void> {
  if (order.kind === PaymentKind.REGISTRATION && order.profileId) {
    await tx.studentProfile.updateMany({
      where: { id: order.profileId, registrationPaidAt: null },
      data: { registrationPaidAt: paidAt },
    });
  }
  if (order.kind === PaymentKind.CERTIFICATE && order.publicId) {
    await tx.certificate.updateMany({
      where: { publicId: order.publicId, viewPaidAt: null },
      data: { viewPaidAt: paidAt },
    });
  }
  if (order.kind === PaymentKind.AGREEMENT && order.publicId) {
    await tx.agreement.updateMany({
      where: { publicId: order.publicId, viewPaidAt: null },
      data: { viewPaidAt: paidAt },
    });
  }
}

/**
 * Atomic fulfill: only PENDING → PAID. Replays are no-ops.
 * Always repairs registrationPaidAt if order is already PAID.
 */
export async function markOrderPaid(opts: {
  orderId: string;
  chargeId?: string | null;
  eventId?: string | null;
  checkoutId?: string | null;
  verifiedAmount?: string | null;
  verifiedCurrency?: string | null;
}): Promise<{ ok: boolean; orderId: string; reason: string }> {
  const paidAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.paymentOrder.findUnique({ where: { id: opts.orderId } });
    if (!existing) return { ok: false as const, reason: "order_not_found" };

    const prevMeta =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const nextMeta = {
      ...prevMeta,
      verifiedAmount: opts.verifiedAmount ?? prevMeta.verifiedAmount,
      verifiedCurrency: opts.verifiedCurrency ?? prevMeta.verifiedCurrency,
      verifiedAt: paidAt.toISOString(),
    } as Prisma.InputJsonValue;

    if (existing.status === PaymentStatus.PAID) {
      await applyFulfillmentSideEffects(tx, existing, existing.paidAt || paidAt);
      if (opts.eventId && !existing.eventId) {
        await tx.paymentOrder.update({
          where: { id: existing.id },
          data: {
            eventId: opts.eventId,
            chargeId: opts.chargeId || existing.chargeId,
            metadata: nextMeta,
          },
        });
      }
      return { ok: true as const, reason: "already_paid_repaired" };
    }

    const updated = await tx.paymentOrder.updateMany({
      where: { id: opts.orderId, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.PAID,
        paidAt,
        chargeId: opts.chargeId || existing.chargeId,
        eventId: opts.eventId || existing.eventId,
        checkoutId: opts.checkoutId || existing.checkoutId,
        metadata: nextMeta,
      },
    });

    if (updated.count === 0) {
      return { ok: false as const, reason: "not_pending" };
    }

    const order = await tx.paymentOrder.findUnique({ where: { id: opts.orderId } });
    if (!order) return { ok: false as const, reason: "order_not_found" };
    await applyFulfillmentSideEffects(tx, order, paidAt);
    return { ok: true as const, reason: "paid" };
  });

  return { ok: result.ok, orderId: opts.orderId, reason: result.reason };
}

export type VerifyResult = {
  ok: boolean;
  orderId?: string;
  reason: string;
  remoteStatus?: string;
};

/**
 * Production fulfillment path:
 * 1) Locate local order
 * 2) Fetch checkout/charge from Bachs with secret key
 * 3) Match reference + amount/currency
 * 4) Atomic PENDING → PAID + unlock student/doc
 */
export async function verifyAndFulfillOrder(opts: {
  checkoutId?: string | null;
  reference?: string | null;
  chargeId?: string | null;
  eventId?: string | null;
  orderId?: string | null;
  profileId?: string | null;
}): Promise<VerifyResult> {
  if (!isBachsConfigured()) {
    return { ok: false, reason: "bachs_not_configured" };
  }

  if (opts.eventId) {
    const seen = await prisma.paymentOrder.findFirst({
      where: { eventId: opts.eventId, status: PaymentStatus.PAID },
      select: { id: true },
    });
    if (seen) {
      return { ok: true, orderId: seen.id, reason: "event_already_processed" };
    }
  }

  let order =
    (opts.orderId
      ? await prisma.paymentOrder.findUnique({ where: { id: opts.orderId } })
      : null) ||
    (opts.checkoutId
      ? await prisma.paymentOrder.findUnique({ where: { checkoutId: opts.checkoutId } })
      : null) ||
    (opts.reference
      ? await prisma.paymentOrder.findUnique({ where: { reference: opts.reference } })
      : null) ||
    (opts.profileId
      ? await prisma.paymentOrder.findFirst({
          where: {
            profileId: opts.profileId,
            kind: PaymentKind.REGISTRATION,
            status: PaymentStatus.PENDING,
            checkoutId: { not: null },
          },
          orderBy: { createdAt: "desc" },
        })
      : null);

  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }

  if (order.status === PaymentStatus.PAID) {
    if (order.kind === PaymentKind.REGISTRATION && order.profileId) {
      await repairRegistrationPaid(order.profileId, order.paidAt || new Date());
    }
    return { ok: true, orderId: order.id, reason: "already_paid" };
  }

  const checkoutId = opts.checkoutId || order.checkoutId;
  if (!checkoutId && !opts.chargeId) {
    return { ok: false, orderId: order.id, reason: "missing_checkout_or_charge" };
  }

  let remote: BachsCheckoutSession | null = null;
  let chargeId = opts.chargeId || order.chargeId || null;

  if (checkoutId) {
    try {
      remote = await getBachsCheckout(checkoutId);
    } catch (err) {
      console.error("[payments.verify] checkout lookup failed", checkoutId, err);
      return { ok: false, orderId: order.id, reason: "bachs_checkout_lookup_failed" };
    }
  }

  if (remote?.charge?.charge_id) {
    chargeId = remote.charge.charge_id;
  }

  // Independent charge verification when we have a charge id.
  if (chargeId) {
    try {
      const charge = await getBachsCharge(chargeId);
      if (!isSuccessfulCharge(charge)) {
        return {
          ok: false,
          orderId: order.id,
          reason: `charge_not_successful:${charge.status || "unknown"}`,
          remoteStatus: charge.status,
        };
      }
      // Bind charge back to our order via checkout/reference when present.
      if (charge.checkout_id && order.checkoutId && charge.checkout_id !== order.checkoutId) {
        return { ok: false, orderId: order.id, reason: "charge_checkout_mismatch" };
      }
      if (charge.reference && charge.reference !== order.reference) {
        // Some charges may use provider refs; only fail if checkout also mismatches.
        if (remote?.reference && remote.reference !== order.reference) {
          return { ok: false, orderId: order.id, reason: "reference_mismatch" };
        }
      }
    } catch (err) {
      console.warn("[payments.verify] charge lookup failed, falling back to checkout", err);
    }
  }

  if (remote) {
    if (remote.reference && remote.reference !== order.reference) {
      return { ok: false, orderId: order.id, reason: "reference_mismatch" };
    }
    if (remote.checkout_id && order.checkoutId && remote.checkout_id !== order.checkoutId) {
      return { ok: false, orderId: order.id, reason: "checkout_id_mismatch" };
    }

    const remoteCurrency = String(remote.currency || "USD").toUpperCase();
    const expectedCurrency = String(order.currency || "USD").toUpperCase();
    if (remote.amount && remoteCurrency === expectedCurrency) {
      if (!moneyEqual(remote.amount, order.amountUsd)) {
        console.error("[payments.verify] amount mismatch", {
          expected: order.amountUsd,
          got: remote.amount,
          currency: remoteCurrency,
          orderId: order.id,
        });
        return { ok: false, orderId: order.id, reason: "amount_mismatch" };
      }
    }

    if (!isSuccessfulCheckout(remote)) {
      return {
        ok: false,
        orderId: order.id,
        reason: `checkout_not_successful:${remote.status}`,
        remoteStatus: remote.status,
      };
    }
  } else if (!chargeId) {
    return { ok: false, orderId: order.id, reason: "no_remote_verification" };
  }

  const marked = await markOrderPaid({
    orderId: order.id,
    chargeId,
    eventId: opts.eventId,
    checkoutId: checkoutId || remote?.checkout_id || order.checkoutId,
    verifiedAmount: remote?.amount || order.amountUsd,
    verifiedCurrency: remote?.currency || order.currency,
  });

  return {
    ok: marked.ok,
    orderId: marked.orderId,
    reason: marked.reason,
    remoteStatus: remote?.status,
  };
}

/** Reconcile all pending orders for a student profile against Bachs. */
export async function reconcileProfilePayments(profileId: string): Promise<{
  checked: number;
  fulfilled: number;
  results: VerifyResult[];
}> {
  const pending = await prisma.paymentOrder.findMany({
    where: {
      profileId,
      kind: PaymentKind.REGISTRATION,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const results: VerifyResult[] = [];
  let fulfilled = 0;

  for (const order of pending) {
    if (order.status === PaymentStatus.PAID) {
      if (order.profileId) {
        await repairRegistrationPaid(order.profileId, order.paidAt || new Date());
      }
      results.push({ ok: true, orderId: order.id, reason: "already_paid_repaired" });
      fulfilled += 1;
      continue;
    }
    if (!order.checkoutId) continue;
    const result = await verifyAndFulfillOrder({
      orderId: order.id,
      checkoutId: order.checkoutId,
      reference: order.reference,
      chargeId: order.chargeId,
    });
    results.push(result);
    if (result.ok) fulfilled += 1;
  }

  return { checked: pending.length, fulfilled, results };
}

/** @deprecated use verifyAndFulfillOrder */
export async function fulfillPaymentOrder(opts: {
  checkoutId?: string | null;
  reference?: string | null;
  chargeId?: string | null;
  eventId?: string | null;
}): Promise<{ ok: boolean; orderId?: string; reason?: string }> {
  return verifyAndFulfillOrder(opts);
}
