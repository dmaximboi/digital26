import { PaymentKind, PaymentStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { issueTemplateDownloadToken } from "./downloadToken.js";

export type DownloadGrant = {
  accessPaid: boolean;
  downloadConsumed: boolean;
  canDownloadTemplatePng: boolean;
  downloadToken: string | null;
};

const EMPTY: DownloadGrant = {
  accessPaid: false,
  downloadConsumed: false,
  canDownloadTemplatePng: false,
  downloadToken: null,
};

export async function payerDownloadGrant(opts: {
  kind: "CERTIFICATE" | "AGREEMENT";
  publicId: string;
  checkoutId?: string | null;
  email?: string | null;
}): Promise<DownloadGrant> {
  const checkoutId = opts.checkoutId?.trim() || "";
  const email = opts.email?.trim().toLowerCase() || "";

  if (opts.kind === "CERTIFICATE") {
    const row = await prisma.certificate.findUnique({
      where: { publicId: opts.publicId },
      select: { viewPaidAt: true, templatePngDownloadedAt: true, status: true },
    });
    if (!row) return EMPTY;
    const proved = await provePayer(PaymentKind.CERTIFICATE, opts.publicId, checkoutId, email);
    if (!proved) return EMPTY;

    const accessPaid = Boolean(row.viewPaidAt);
    const downloadConsumed = Boolean(row.templatePngDownloadedAt);
    const eligible = accessPaid && row.status === "VALID" && !downloadConsumed;
    if (!eligible) {
      return { accessPaid, downloadConsumed, canDownloadTemplatePng: false, downloadToken: null };
    }
    return {
      accessPaid,
      downloadConsumed: false,
      canDownloadTemplatePng: true,
      downloadToken: issueTemplateDownloadToken("certificate", opts.publicId).token,
    };
  }

  const row = await prisma.agreement.findUnique({
    where: { publicId: opts.publicId },
    select: { viewPaidAt: true, templatePngDownloadedAt: true, consumedAt: true },
  });
  if (!row) return EMPTY;
  const proved = await provePayer(PaymentKind.AGREEMENT, opts.publicId, checkoutId, email);
  if (!proved) return EMPTY;

  const accessPaid = Boolean(row.viewPaidAt);
  const downloadConsumed = Boolean(row.templatePngDownloadedAt);
  const eligible = accessPaid && Boolean(row.consumedAt) && !downloadConsumed;
  if (!eligible) {
    return { accessPaid, downloadConsumed, canDownloadTemplatePng: false, downloadToken: null };
  }
  return {
    accessPaid,
    downloadConsumed: false,
    canDownloadTemplatePng: true,
    downloadToken: issueTemplateDownloadToken("agreement", opts.publicId).token,
  };
}

async function provePayer(
  kind: PaymentKind,
  publicId: string,
  checkoutId: string,
  email: string,
): Promise<boolean> {
  if (checkoutId && checkoutId.length <= 200) {
    const byCheckout = await prisma.paymentOrder.findUnique({
      where: { checkoutId },
      select: { status: true, kind: true, publicId: true },
    });
    if (
      byCheckout?.status === PaymentStatus.PAID &&
      byCheckout.kind === kind &&
      byCheckout.publicId === publicId
    ) {
      return true;
    }
  }
  if (email && email.length <= 200) {
    const byEmail = await prisma.paymentOrder.findFirst({
      where: {
        kind,
        publicId,
        status: PaymentStatus.PAID,
        customerEmail: email,
      },
      select: { id: true },
    });
    return Boolean(byEmail);
  }
  return false;
}

export async function paidCheckoutIdForEmail(
  kind: PaymentKind,
  publicId: string,
  email: string,
): Promise<string | null> {
  const row = await prisma.paymentOrder.findFirst({
    where: {
      kind,
      publicId,
      status: PaymentStatus.PAID,
      customerEmail: email.trim().toLowerCase(),
      checkoutId: { not: null },
    },
    orderBy: { paidAt: "desc" },
    select: { checkoutId: true },
  });
  return row?.checkoutId || null;
}
