import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

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
    })
  : null;


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

  await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html ?? `<pre style="font-family:sans-serif;white-space:pre-wrap">${args.text}</pre>`,
  });

  return { delivered: true, mode: "smtp" };
}

export async function sendPasskeyEmail(opts: {
  to: string;
  passkey: string;
  link: string;
  expiresAt: Date;
}): Promise<void> {
  const expires = opts.expiresAt.toUTCString();
  await sendMail({
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
}

export async function sendOtpEmail(opts: { to: string; code: string }): Promise<void> {
  await sendMail({
    to: opts.to,
    subject: "The Digital 26 verification code",
    text: [
      `Your verification code is: ${opts.code}`,
      "",
      "It expires in 10 minutes. If you did not request this, ignore this email.",
    ].join("\n"),
  });
}
