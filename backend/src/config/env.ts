import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1).optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(1).optional(),
  /** Comma-separated admin emails (server only). No hardcoded defaults. */
  ADMIN_EMAILS: z.string().min(1, "ADMIN_EMAILS is required"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,https://digital26.online"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  PUBLIC_SITE_URL: z.string().url().default("https://digital26.online"),
  API_URL: z.string().url().default("http://localhost:4000"),
  NEON_AUTH_URL: z.string().url().optional(),
  NEON_AUTH_JWKS_URL: z.string().url().optional(),
  NEON_AUTH_COOKIE_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  IMAGEKIT_PUBLIC_KEY: z.string().optional(),
  IMAGEKIT_PRIVATE_KEY: z.string().optional(),
  IMAGEKIT_URL_ENDPOINT: z.string().url().optional(),
  IMAGEKIT_FOLDER: z.string().default("digital26/students"),
  /** Max JSON body (bytes) — defense in depth */
  JSON_BODY_LIMIT: z.string().default("100kb"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;
const isProd = data.NODE_ENV === "production";

if (isProd && !data.FIELD_ENCRYPTION_KEY) {
  console.error("FIELD_ENCRYPTION_KEY is required in production");
  process.exit(1);
}

if (isProd && (!data.NEON_AUTH_URL || !data.NEON_AUTH_JWKS_URL)) {
  console.error("NEON_AUTH_URL and NEON_AUTH_JWKS_URL are required in production");
  process.exit(1);
}

const adminEmails = data.ADMIN_EMAILS.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (adminEmails.length === 0) {
  console.error("ADMIN_EMAILS must list at least one admin email");
  process.exit(1);
}

export const env = {
  ...data,
  isProd,
  adminEmails,
  corsOrigins: data.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
