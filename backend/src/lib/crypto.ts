import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { env } from "../config/env.js";

/** Hash one-time passkeys - never store plaintext */
export function hashPasskey(passkey: string): string {
  if (!env.FIELD_ENCRYPTION_KEY) {
    if (env.isProd) {
      throw new Error("FIELD_ENCRYPTION_KEY is required in production");
    }
    throw new Error(
      "FIELD_ENCRYPTION_KEY is required to hash passkeys. Set it in backend/.env",
    );
  }
  return createHmac("sha256", env.FIELD_ENCRYPTION_KEY).update(passkey).digest("hex");
}

export function verifyPasskey(passkey: string, storedHash: string): boolean {
  const next = Buffer.from(hashPasskey(passkey), "hex");
  const prev = Buffer.from(storedHash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function generatePasskey(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

export function generateSessionId(): string {
  return randomBytes(24).toString("hex");
}

function getKey(): Buffer {
  if (!env.FIELD_ENCRYPTION_KEY) {
    throw new Error("FIELD_ENCRYPTION_KEY is required to encrypt sensitive fields");
  }
  const key = Buffer.from(env.FIELD_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptField(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function deriveDevKey(secret: string): string {
  return scryptSync(secret, "digital26", 32).toString("base64");
}
