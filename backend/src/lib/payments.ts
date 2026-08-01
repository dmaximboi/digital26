import { PaymentKind, PaymentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";

export const PAYMENT_AMOUNTS_USD: Record<PaymentKind, string> = {
  REGISTRATION: "3.00",
  CERTIFICATE: "1.00",
  AGREEMENT: "1.00",
};

export function paymentLabel(kind: PaymentKind): string {
  if (kind === "REGISTRATION") return "Student registration fee";
  if (kind === "CERTIFICATE") return "Certificate access";
  return "Agreement letter access";
}

export function newPaymentReference(kind: PaymentKind): string {
  const prefix =
    kind === "REGISTRATION" ? "reg" : kind === "CERTIFICATE" ? "cert" : "agr";
  return `d26_${prefix}_${randomBytes(8).toString("hex")}`;
}

export async function isCertificateAccessPaid(publicId: string): Promise<boolean> {
  const row = await prisma.certificate.findUnique({
    where: { publicId },
    select: { viewPaidAt: true },
  });
  return Boolean(row?.viewPaidAt);
}

export async function isAgreementAccessPaid(publicId: string): Promise<boolean> {
  const row = await prisma.agreement.findUnique({
    where: { publicId },
    select: { viewPaidAt: true },
  });
  return Boolean(row?.viewPaidAt);
}

export async function fulfillPaymentOrder(opts: {
  checkoutId?: string | null;
  reference?: string | null;
  chargeId?: string | null;
  eventId?: string | null;
}): Promise<{ ok: boolean; orderId?: string; reason?: string }> {
  if (opts.eventId) {
    const seen = await prisma.paymentOrder.findFirst({
      where: { eventId: opts.eventId },
      select: { id: true },
    });
    if (seen) return { ok: true, orderId: seen.id, reason: "already_processed" };
  }

  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [
        ...(opts.checkoutId ? [{ checkoutId: opts.checkoutId }] : []),
        ...(opts.reference ? [{ reference: opts.reference }] : []),
      ],
    },
  });

  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }

  if (order.status === PaymentStatus.PAID) {
    if (opts.eventId && !order.eventId) {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { eventId: opts.eventId, chargeId: opts.chargeId || order.chargeId },
      });
    }
    return { ok: true, orderId: order.id, reason: "already_paid" };
  }

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt,
        chargeId: opts.chargeId || order.chargeId,
        eventId: opts.eventId || order.eventId,
        checkoutId: opts.checkoutId || order.checkoutId,
      },
    });

    if (order.kind === PaymentKind.REGISTRATION && order.profileId) {
      await tx.studentProfile.update({
        where: { id: order.profileId },
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
  });

  return { ok: true, orderId: order.id };
}
