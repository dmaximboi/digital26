import { createReadStream } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import ImageKit, { toFile } from "@imagekit/nodejs";
import sharp from "sharp";
import { env } from "../config/env.js";

/** Relative public path (local fallback when ImageKit is not configured). */
export function studentPhotoPublicPath(filename: string): string {
  return `/api/public/files/students/${filename}`;
}

export function studentPhotoAbsoluteUrl(publicPath: string): string {
  if (publicPath.startsWith("http")) return publicPath;
  return `${env.API_URL.replace(/\/$/, "")}${publicPath}`;
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

/**
 * Compress + store student portrait.
 * Prefers ImageKit when credentials are set; otherwise local disk + sharp.
 */
export async function compressAndStoreStudentPhoto(
  tempPath: string,
  uploadDir: string,
): Promise<{ filename: string; diskPath?: string; publicPath: string }> {
  const filename = `${Date.now()}-portrait.jpg`;
  const compressed = await sharp(tempPath)
    .rotate()
    .resize(720, 900, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  try {
    await unlink(tempPath);
  } catch {
    // temp cleanup best-effort
  }

  if (imagekitEnabled()) {
    const client = getImageKit();
    const folder = (env.IMAGEKIT_FOLDER || "digital26/students").replace(/\/$/, "");
    const result = await client.files.upload({
      file: await toFile(compressed, filename),
      fileName: filename,
      folder,
      useUniqueFileName: true,
      tags: ["student", "certificate"],
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

  return {
    filename,
    diskPath,
    publicPath: studentPhotoPublicPath(filename),
  };
}

/** Load portrait bytes for PDF embed (local path or remote ImageKit URL). */
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

/** Optional helper if you need a stream of a local file (tests / legacy). */
export function openLocalPhotoStream(diskPath: string) {
  return createReadStream(diskPath);
}
