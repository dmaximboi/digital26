import { createReadStream } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import ImageKit, { toFile } from "@imagekit/nodejs";
import sharp from "sharp";
import { env } from "../config/env.js";

const TARGET_BYTES = 300 * 1024;

export function studentPhotoPublicPath(filename: string): string {
  return `/api/public/files/students/${filename}`;
}

export function studentPhotoAbsoluteUrl(publicPath: string): string {
  if (publicPath.startsWith("http")) return publicPath;
  return `${env.API_URL.replace(/\/$/, "")}${publicPath}`;
}

export function optimizedPhotoUrl(url: string, width = 400, quality = 70): string {
  if (!url.startsWith("http") || !url.includes("imagekit.io")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}tr=w-${width},q-${quality},f-webp`;
}

function imagekitEnabled(): boolean {
  return Boolean(env.IMAGEKIT_PRIVATE_KEY && env.IMAGEKIT_URL_ENDPOINT);
}

function getImageKit() {
  if (!env.IMAGEKIT_PRIVATE_KEY) {
    throw new Error("IMAGEKIT_PRIVATE_KEY is not set");
  }
  return new ImageKit({ privateKey: env.IMAGEKIT_PRIVATE_KEY });
}

async function compressToTarget(tempPath: string, maxBytes = TARGET_BYTES): Promise<Buffer> {
  let width = 800;
  let height = 1000;
  let quality = 75;

  let best: Buffer | null = null;

  for (let attempt = 0; attempt < 14; attempt++) {
    const buf = await sharp(tempPath)
      .rotate()
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();

    best = buf;
    if (buf.length <= maxBytes) return buf;

    if (quality > 40) {
      quality = Math.max(38, quality - 8);
    } else {
      width = Math.max(240, Math.round(width * 0.82));
      height = Math.max(240, Math.round(height * 0.82));
      quality = 68;
    }
  }

  if (best && best.length > maxBytes) {
    width = 220;
    height = 280;
    quality = 32;
    best = await sharp(tempPath)
      .rotate()
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  }

  if (!best || best.length > maxBytes) {
    throw new Error("Image could not be compressed to 300KB");
  }

  return best;
}

export async function compressAndStoreStudentPhoto(
  tempPath: string,
  uploadDir: string,
  opts?: { folder?: string; tags?: string[]; publicKind?: "students" | "evidence" },
): Promise<{ filename: string; diskPath?: string; publicPath: string }> {
  const filename = `${Date.now()}-portrait.jpg`;
  const compressed = await compressToTarget(tempPath);

  try {
    await unlink(tempPath);
  } catch {}

  if (imagekitEnabled()) {
    const client = getImageKit();
    const defaultFolder = opts?.publicKind === "evidence" ? "digital26/evidence" : "digital26/students";
    const folder = (opts?.folder || env.IMAGEKIT_FOLDER || defaultFolder).replace(/\/$/, "");
    const result = await client.files.upload({
      file: await toFile(compressed, filename),
      fileName: filename,
      folder,
      useUniqueFileName: true,
      tags: opts?.tags || ["student", "certificate"],
    });

    const url = result.url;
    if (!url) {
      throw new Error("ImageKit upload did not return a URL");
    }

    return {
      filename: result.name || filename,
      publicPath: url,
    };
  }

  const diskPath = path.join(uploadDir, filename);
  await writeFile(diskPath, compressed);

  const publicPath =
    opts?.publicKind === "evidence"
      ? `/api/public/files/students/${filename}`
      : studentPhotoPublicPath(filename);

  return {
    filename,
    diskPath,
    publicPath,
  };
}

export async function loadPhotoBytes(opts: {
  photoPath?: string;
  photoUrl?: string;
}): Promise<{ bytes: Buffer; kind: "jpg" | "png" } | null> {
  try {
    if (opts.photoPath) {
      const { readFile } = await import("node:fs/promises");
      const bytes = await readFile(opts.photoPath);
      const kind = opts.photoPath.toLowerCase().endsWith(".png") ? "png" : "jpg";
      return { bytes, kind };
    }

    const url = opts.photoUrl;
    if (!url || !url.startsWith("http")) return null;

    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const bytes = Buffer.from(ab);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const kind = ct.includes("png") || url.toLowerCase().includes(".png") ? "png" : "jpg";
    return { bytes, kind };
  } catch {
    return null;
  }
}

export function openLocalPhotoStream(diskPath: string) {
  return createReadStream(diskPath);
}
