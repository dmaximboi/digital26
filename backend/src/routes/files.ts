import { Router } from "express";
import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { env } from "../config/env.js";

export const filesRouter = Router();

function uploadsRoot(): string {
  return path.resolve(env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads"));
}

function safeResolveUnderRoot(root: string, ...parts: string[]): string | null {
  const resolved = path.resolve(root, ...parts);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}


filesRouter.get("/files/:kind/:filename", (req, res) => {
  const kind = String(req.params.kind ?? "");
  const filename = String(req.params.filename ?? "");

  if (kind !== "students") {
    res.status(403).json({
      error: "Agreement and certificate PDFs require an authenticated console session.",
    });
    return;
  }

  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const root = uploadsRoot();
  const filePath = safeResolveUnderRoot(root, kind, filename);
  if (!filePath || !existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(filename).toLowerCase();
  const type =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=86400");
  createReadStream(filePath).pipe(res);
});
