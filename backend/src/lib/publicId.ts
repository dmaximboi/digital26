import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;


const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const TOKEN_LEN = 8;
const MAX_ATTEMPTS = 16;


export const PUBLIC_ID_RE = /^D26[A-Za-z0-9]{8}$/;
export const PUBLIC_ID_LEGACY_RE =
  /^D26(?:\d{5}|[A-Za-z0-9\-_~]{8,12})(?:agr|cert)?$/i;

export function isValidPublicId(publicId: string): boolean {
  return PUBLIC_ID_RE.test(publicId) || PUBLIC_ID_LEGACY_RE.test(publicId);
}

function randomToken(len = TOKEN_LEN): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length]!;
  }
  return out;
}


async function existsAnywhere(db: Db, publicId: string): Promise<boolean> {
  const [c, cp, a, ap] = await Promise.all([
    db.certificate.findUnique({ where: { publicId }, select: { id: true } }),
    db.certificatePublic.findUnique({ where: { publicId }, select: { publicId: true } }),
    db.agreement.findUnique({ where: { publicId }, select: { id: true } }),
    db.agreementPublic.findUnique({ where: { publicId }, select: { publicId: true } }),
  ]);
  return Boolean(c || cp || a || ap);
}


export async function nextPublicId(db: Db): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `D26${randomToken()}`;
    if (!(await existsAnywhere(db, candidate))) {
      return candidate;
    }
  }
  throw new Error("Could not allocate a unique public ID");
}
