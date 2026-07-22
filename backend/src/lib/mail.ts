import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const SMTP_TIMEOUT_MS = 12_000;

export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_USER && env.SMTP_PASS && env.SMTP_HOST);
}

export function mailTransportLabel(): string {
  if (isResendConfigured()) return `resend`;
  if (isSmtpConfigured()) return `smtp:${env.SMTP_HOST}`;
  return "none";
}

const transporter = isSmtpConfigured()
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      requireTLS: (env.SMTP_PORT ?? 587) === 587,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    })
  : null;

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
  if (isResendConfigured()) return "The Digital 26 <onboarding@resend.dev>";
  return "The Digital 26 <noreply@digital26.online>";
}

function friendlyMailError(raw: string): string {
  const msg = raw.toLowerCase();
  if (
    msg.includes("timed out") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("enetunreach") ||
    msg.includes("esocket")
  ) {
    return "SMTP is blocked on Render free tier. Add RESEND_API_KEY (https://resend.com) and redeploy.";
  }
  if (msg.includes("smtp is not configured") || msg.includes("no email transport")) {
    return "Email is not configured. Set RESEND_API_KEY on Render (recommended) or use a paid host with SMTP.";
  }
  return raw;
}

async function sendViaResend(args: SendArgs): Promise<void> {
  const key = env.RESEND_API_KEY!.trim();
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
        text: args.text,
        html:
          args.html ??
          `<pre style="font-family:sans-serif;white-space:pre-wrap">${args.text}</pre>`,
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

async function sendViaSmtp(args: SendArgs): Promise<void> {
  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  await withTimeout(
    transporter.sendMail({
      from: defaultFrom(),
      to: args.to,
      subject: args.subject,
      text: args.text,
      html:
        args.html ??
        `<pre style="font-family:sans-serif;white-space:pre-wrap">${args.text}</pre>`,
    }),
    SMTP_TIMEOUT_MS + 2_000,
    "SMTP send",
  );
}

export async function sendMail(
  args: SendArgs,
): Promise<{ delivered: boolean; mode: "resend" | "smtp" | "console" }> {
  if (isResendConfigured()) {
    await sendViaResend(args);
    return { delivered: true, mode: "resend" };
  }

  if (transporter) {
    await sendViaSmtp(args);
    return { delivered: true, mode: "smtp" };
  }

  if (env.isProd) {
    throw new Error("No email transport configured");
  }

  console.log("\n========== EMAIL (dev console - set RESEND_API_KEY or SMTP_*) ==========");
  console.log(`To: ${args.to}`);
  console.log(`Subject: ${args.subject}`);
  console.log(args.text);
  console.log("========================================================================\n");
  return { delivered: true, mode: "console" };
}

export async function trySendMail(
  args: SendArgs,
): Promise<{
  delivered: boolean;
  mode: "resend" | "smtp" | "console" | "failed";
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
    ].join("\n"),
  });
  return { delivered: result.delivered, error: result.error };
}

export async function sendOtpEmail(opts: { to: string; code: string }): Promise<void> {
  const result = await trySendMail({
    to: opts.to,
    subject: "The Digital 26 verification code",
    text: [
      `Your verification code is: ${opts.code}`,
      "",
      "It expires in 10 minutes. If you did not request this, ignore this email.",
    ].join("\n"),
  });
  if (!result.delivered) {
    throw new Error(result.error || "Failed to send verification email");
  }
}
