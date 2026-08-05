import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export type BachsCharge = {
  charge_id?: string;
  status?: string;
  amount?: string;
  amount_paid?: string;
  currency?: string;
  reference?: string | null;
  checkout_id?: string | null;
};

export type BachsCheckoutSession = {
  checkout_id: string;
  checkout_url?: string;
  status: string;
  payment_status?: string | null;
  amount?: string;
  currency?: string;
  expires_at?: string;
  created_at?: string;
  reference?: string | null;
  charge?: BachsCharge | null;
  metadata?: Record<string, string> | null;
  customer_email?: string | null;
};

export function isBachsConfigured(): boolean {
  return Boolean(env.BACHS_API_KEY?.trim());
}

function bachsBaseUrl(): string {
  if (env.BACHS_API_BASE?.trim()) {
    return env.BACHS_API_BASE.trim().replace(/\/$/, "");
  }
  return "https://api.bachs.io";
}

async function bachsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = env.BACHS_API_KEY?.trim();
  if (!key) throw new Error("BACHS_API_KEY is not configured");
  if (key.startsWith("sk_sandbox_")) {
    throw new Error(
      "Sandbox Bachs keys are disabled. Use a live key (sk_live_...) from app.bachs.io.",
    );
  }

  const res = await fetch(`${bachsBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as {
    detail?: string;
    error_code?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      body.detail || body.message || body.error || `Bachs API failed (${res.status})`,
    );
  }

  return body as T;
}

export async function createBachsCheckout(opts: {
  amountUsd: string;
  customerEmail: string;
  customerName: string;
  successUrl: string;
  cancelUrl: string;
  reference: string;
  metadata: Record<string, string>;
}): Promise<BachsCheckoutSession> {
  return bachsFetch<BachsCheckoutSession>("/v1/checkout-sessions", {
    method: "POST",
    body: JSON.stringify({
      pricing: {
        currency: "USD",
        amount: opts.amountUsd,
        price_type: "fixed",
      },
      customer: {
        email: opts.customerEmail,
        name: opts.customerName,
      },
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      reference: opts.reference,
      metadata: opts.metadata,
      expires_in_minutes: 60,
    }),
  });
}

/** Authoritative checkout lookup — never trust webhook body alone. */
export async function getBachsCheckout(checkoutId: string): Promise<BachsCheckoutSession> {
  return bachsFetch<BachsCheckoutSession>(
    `/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`,
  );
}

/** Authoritative charge/payin lookup. */
export async function getBachsCharge(chargeId: string): Promise<BachsCharge> {
  try {
    return await bachsFetch<BachsCharge>(
      `/v1/payments/charges/${encodeURIComponent(chargeId)}`,
    );
  } catch {
    return bachsFetch<BachsCharge>(
      `/v1/payments/payins/${encodeURIComponent(chargeId)}`,
    );
  }
}

export function isSuccessfulCheckout(remote: BachsCheckoutSession): boolean {
  const status = String(remote.status || "").toUpperCase();
  const paymentStatus = String(remote.payment_status || "").toLowerCase();
  const chargeStatus = String(remote.charge?.status || "").toLowerCase();

  if (status === "COMPLETED") return true;
  if (["succeeded", "accepted", "overpaid", "paid"].includes(paymentStatus)) return true;
  if (["succeeded", "accepted", "overpaid", "paid"].includes(chargeStatus)) return true;
  return false;
}

export function isSuccessfulCharge(charge: BachsCharge): boolean {
  const status = String(charge.status || "").toLowerCase();
  return ["succeeded", "accepted", "overpaid", "paid"].includes(status);
}

export function verifyBachsWebhookSignature(opts: {
  rawBody: string | Buffer;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  toleranceSeconds?: number;
}): boolean {
  const secret = env.BACHS_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const ts = opts.timestampHeader?.trim();
  const sig = opts.signatureHeader?.trim();
  if (!ts || !sig) return false;

  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return false;

  const tolerance = opts.toleranceSeconds ?? 300;
  if (Math.abs(Date.now() / 1000 - timestamp) > tolerance) return false;

  const raw = typeof opts.rawBody === "string" ? opts.rawBody : opts.rawBody.toString("utf8");
  const message = `${timestamp}.${raw}`;
  const expected = createHmac("sha256", secret).update(message, "utf8").digest("hex");

  try {
    const left = Buffer.from(expected, "utf8");
    const right = Buffer.from(sig, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
