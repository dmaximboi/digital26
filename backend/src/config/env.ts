import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pathSegment = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1).optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(1).optional(),
  STAFF_EMAILS: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  CONSOLE_PATH: pathSegment.optional(),
  ADMIN_CONSOLE_PATH: pathSegment.optional(),
  CORS_ORIGINS: z
    .string()
    .default(
      "https://digital26.online,https://www.digital26.online,http://localhost:5173",
    ),
  APP_URL: z.string().url().default("https://digital26.online"),
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
  JSON_BODY_LIMIT: z.string().default("100kb"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration");
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

const staffEmailSource = data.STAFF_EMAILS || data.ADMIN_EMAILS || "";
const adminEmails = staffEmailSource
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (adminEmails.length === 0) {
  console.error("STAFF_EMAILS is required");
  process.exit(1);
}

const consolePath = data.CONSOLE_PATH || data.ADMIN_CONSOLE_PATH;
if (!consolePath) {
  console.error("CONSOLE_PATH is required");
  process.exit(1);
}

function withWwwVariants(origins: string[]): string[] {
  const out = new Set<string>();
  for (const origin of origins) {
    out.add(origin);
    try {
      const u = new URL(origin);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        continue;
      }
      if (u.hostname.startsWith("www.")) {
        u.hostname = u.hostname.slice(4);
      } else {
        u.hostname = `www.${u.hostname}`;
      }
      out.add(u.origin);
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

export const env = {
  ...data,
  isProd,
  ADMIN_EMAILS: staffEmailSource,
  ADMIN_CONSOLE_PATH: consolePath,
  adminEmails,
  consolePath,
  corsOrigins: withWwwVariants(
    data.CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ),
};
