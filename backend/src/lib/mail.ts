import { env } from "../config/env.js";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

/** @deprecated SMTP is unused — Render free blocks it. Kept name for older logs. */
export function isSmtpConfigured(): boolean {
  return false;
}

export function mailTransportLabel(): string {
  return isResendConfigured() ? "resend" : "none";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function defaultFrom(): string {
  if (env.EMAIL_FROM?.trim()) return env.EMAIL_FROM.trim();
  return "The Digital 26 <onboarding@resend.dev>";
}

function fromAddressOnly(): string {
  const from = defaultFrom();
  const match = /<([^>]+)>/.exec(from);
  return (match?.[1] || from).trim();
}

function deliveryHints(): string {
  const sender = fromAddressOnly();
  return [
    "Important: if you do not see this message in your inbox, check Spam, Junk, or Promotions.",
    `If you use Gmail, open this email, tap Not spam, and add ${sender} to Contacts so future Digital 26 mail stays in Primary.`,
  ].join("\n");
}

function withDeliveryHints(text: string): string {
  if (/check Spam|Not spam|add .+ to Contacts/i.test(text)) return text;
  return `${text.trim()}\n\n${deliveryHints()}`;
}

function friendlyMailError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("not configured") || msg.includes("no email transport")) {
    return "Email is not configured. Set RESEND_API_KEY on Render and redeploy.";
  }
  return raw;
}

async function sendViaResend(args: SendArgs): Promise<void> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY is not configured");

  const text = withDeliveryHints(args.text);
  const html = `<pre style="font-family:sans-serif;white-space:pre-wrap">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`;

  const res = await withTimeout(
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: defaultFrom(),
        to: [args.to],
        subject: args.subject,
        text,
        html,
      }),
    }),
    15_000,
    "Resend API",
  );

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    name?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      body.error?.message || body.message || body.name || `Resend failed (${res.status})`,
    );
  }
}

export async function sendMail(
  args: SendArgs,
): Promise<{ delivered: boolean; mode: "resend" | "console" }> {
  if (isResendConfigured()) {
    await sendViaResend(args);
    return { delivered: true, mode: "resend" };
  }

  if (env.isProd) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const text = withDeliveryHints(args.text);
  console.log("\n========== EMAIL (dev — set RESEND_API_KEY) ==========");
  console.log(`From: ${defaultFrom()}`);
  console.log(`To: ${args.to}`);
  console.log(`Subject: ${args.subject}`);
  console.log(text);
  console.log("======================================================\n");
  return { delivered: true, mode: "console" };
}

export async function trySendMail(
  args: SendArgs,
): Promise<{
  delivered: boolean;
  mode: "resend" | "console" | "failed";
  error?: string;
}> {
  try {
    const result = await sendMail(args);
    return result;
  } catch (err) {
    const message = friendlyMailError(err instanceof Error ? err.message : "Email failed");
    console.error("[mail]", message);
    return { delivered: false, mode: "failed", error: message };
  }
}

export async function sendPasskeyEmail(opts: {
  to: string;
  passkey: string;
  link: string;
  expiresAt: Date;
}): Promise<{ delivered: boolean; error?: string }> {
  const expires = opts.expiresAt.toUTCString();
  const sender = fromAddressOnly();
  const result = await trySendMail({
    to: opts.to,
    subject: "The Digital 26 agreement passkey",
    text: [
      "You have a Digital 26 agreement waiting for your signature.",
      "",
      `Open this link (valid for 24 hours until ${expires}):`,
      opts.link,
      "",
      `One-time passkey: ${opts.passkey}`,
      "",
      "This passkey works once. Do not share it.",
      "",
      "Important: if you do not see this message in your inbox, check Spam, Junk, or Promotions.",
      `If you use Gmail, open this email, tap Not spam, and add ${sender} to Contacts so future Digital 26 mail stays in Primary.`,
    ].join("\n"),
  });
  return { delivered: result.delivered, error: result.error };
}

export async function sendOtpEmail(opts: { to: string; code: string }): Promise<void> {
  const sender = fromAddressOnly();
  const result = await trySendMail({
    to: opts.to,
    subject: "The Digital 26 verification code",
    text: [
      `Your Digital 26 verification code is: ${opts.code}`,
      "",
      "Enter this 6-digit code on the website. It expires in 10 minutes.",
      "If you did not request this, ignore this email.",
      "",
      "Important: if you do not see this message in your inbox, check Spam, Junk, or Promotions.",
      `If you use Gmail, open this email, tap Not spam, and add ${sender} to Contacts so future Digital 26 mail stays in Primary.`,
    ].join("\n"),
  });
  if (!result.delivered) {
    throw new Error(result.error || "Failed to send verification email");
  }
}

export async function sendCertificateClaimEmail(opts: {
  to: string;
  claimLink: string;
}): Promise<{ delivered: boolean; error?: string }> {
  const sender = fromAddressOnly();
  const result = await trySendMail({
    to: opts.to,
    subject: "Your Digital 26 certificate claim link",
    text: [
      "You have a Digital 26 certificate waiting for your acknowledgement.",
      "",
      "Open this link within 24 hours:",
      opts.claimLink,
      "",
      "Use this same email address when claiming. You will confirm with a code,",
      "enter your name and phone, and upload your photo.",
      "After you submit, the link expires and your certificate becomes public.",
      "",
      "Important: if you do not see this message in your inbox, check Spam, Junk, or Promotions.",
      `If you use Gmail, open this email, tap Not spam, and add ${sender} to Contacts so future Digital 26 mail stays in Primary.`,
    ].join("\n"),
  });
  return { delivered: result.delivered, error: result.error };
}
