import path from "node:path";
import { mkdirSync } from "node:fs";
import multer from "multer";
import type { Request } from "express";
import { EvidenceKind } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { compressAndStoreStudentPhoto } from "./studentPhoto.js";
import { env } from "../config/env.js";

// Store on the same durable path the public files router can serve (students),
// or ImageKit when configured. Avoid Render ephemeral "uploads/evidence" orphans.
const uploadRoot = path.resolve(
  env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads"),
  "students",
);
mkdirSync(uploadRoot, { recursive: true });

export const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

export function filesFromRequest(
  req: Request,
  field: string,
): Express.Multer.File[] {
  const bag = req.files;
  if (!bag) return [];
  if (Array.isArray(bag)) return bag.filter((f) => f.fieldname === field);
  return bag[field] ?? [];
}

export async function storeEvidenceFiles(opts: {
  files: Express.Multer.File[];
  kind: EvidenceKind;
  uploadedBy: "admin" | "client" | "student";
  agreementId?: string;
  certificateId?: string;
  phoneHint?: string | null;
}): Promise<number> {
  let count = 0;
  for (const file of opts.files) {
    const stored = await compressAndStoreStudentPhoto(file.path, uploadRoot, {
      publicKind: "evidence",
      tags: ["evidence", opts.kind.toLowerCase()],
      folder: "digital26/evidence",
    });
    try {
      await prisma.evidenceImage.create({
        data: {
          kind: opts.kind,
          url: stored.publicPath,
          uploadedBy: opts.uploadedBy,
          agreementId: opts.agreementId,
          certificateId: opts.certificateId,
          phoneHint: opts.phoneHint?.trim() || null,
        },
      });
    } catch (err) {
      console.warn("[evidence] evidence_images table not ready — image stored but not tracked:", err);
    }
    count += 1;
  }
  return count;
}
