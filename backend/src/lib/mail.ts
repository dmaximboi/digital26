import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const SMTP_TIMEOUT_MS = 12_000;

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_USER && env.SMTP_PASS && env.SMTP_HOST);
}

const transporter = isSmtpConfigured()
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: false,
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

export async function sendMail(
  args: SendArgs,
): Promise<{ delivered: boolean; mode: "smtp" | "console" }> {
  const from = env.EMAIL_FROM || "The Digital 26 <noreply@digital26.online>";

  if (!transporter) {
    if (env.isProd) {
      throw new Error("SMTP is not configured");
    }
    console.log("\n========== EMAIL (dev console - set SMTP_USER/SMTP_PASS) ==========");
    console.log(`To: ${args.to}`);
    console.log(`Subject: ${args.subject}`);
    console.log(args.text);
    console.log("===================================================================\n");
    return { delivered: true, mode: "console" };
  }

  await withTimeout(
    transporter.sendMail({
      from,
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

  return { delivered: true, mode: "smtp" };
}

export async function trySendMail(
  args: SendArgs,
): Promise<{ delivered: boolean; mode: "smtp" | "console" | "failed"; error?: string }> {
  try {
    const result = await sendMail(args);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed";
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
