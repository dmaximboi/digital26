import ImageKit from "@imagekit/nodejs";
import { env } from "../config/env.js";

export function imagekitEnabled(): boolean {
  return Boolean(env.IMAGEKIT_PRIVATE_KEY && env.IMAGEKIT_URL_ENDPOINT);
}

export function getImageKit(): ImageKit {
  if (!env.IMAGEKIT_PRIVATE_KEY) {
    throw new Error("IMAGEKIT_PRIVATE_KEY is not set");
  }
  return new ImageKit({ privateKey: env.IMAGEKIT_PRIVATE_KEY });
}

export function isImageKitUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith("http") && url.includes("imagekit.io"));
}

function extractFileName(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export async function deleteImageKitByUrl(url: string): Promise<boolean> {
  if (!imagekitEnabled() || !isImageKitUrl(url)) return false;
  const client = getImageKit();
  const name = extractFileName(url);
  if (!name) return false;

  try {
    const assets = await client.assets.list({
      type: "file",
      searchQuery: `name="${name}"`,
      limit: 20,
    });
    const files = Array.isArray(assets) ? assets : [];
    let deleted = false;
    for (const file of files) {
      const fileId = (file as { fileId?: string }).fileId;
      const fileUrl = (file as { url?: string }).url;
      if (!fileId) continue;
      if (fileUrl && !url.includes(name)) continue;
      await client.files.delete(fileId);
      deleted = true;
    }
    return deleted;
  } catch (err) {
    console.warn("[imagekit.delete]", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function deleteImageKitUrls(urls: Array<string | null | undefined>): Promise<number> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u && isImageKitUrl(u))))];
  let count = 0;
  for (const url of unique) {
    if (await deleteImageKitByUrl(url)) count += 1;
  }
  return count;
}

export async function purgeImageKitFolders(folders: string[]): Promise<{ deleted: number; errors: number }> {
  if (!imagekitEnabled()) return { deleted: 0, errors: 0 };
  const client = getImageKit();
  let deleted = 0;
  let errors = 0;

  for (const folder of folders) {
    const path = `/${folder.replace(/^\/+|\/+$/g, "")}/`;
    for (let page = 0; page < 50; page++) {
      try {
        const assets = await client.assets.list({
          type: "file",
          path,
          limit: 100,
          skip: 0,
        });
        const files = Array.isArray(assets) ? assets : [];
        if (files.length === 0) break;

        const ids = files
          .map((f) => (f as { fileId?: string }).fileId)
          .filter((id): id is string => Boolean(id));

        if (ids.length > 0) {
          try {
            await client.files.bulk.delete({ fileIds: ids });
            deleted += ids.length;
          } catch {
            for (const id of ids) {
              try {
                await client.files.delete(id);
                deleted += 1;
              } catch {
                errors += 1;
              }
            }
          }
        }

        if (files.length < 100) break;
      } catch (err) {
        console.warn("[imagekit.purge]", folder, err instanceof Error ? err.message : err);
        errors += 1;
        break;
      }
    }
  }

  return { deleted, errors };
}

export async function listImageKitStats(folders: string[]): Promise<{
  files: number;
  bytes: number;
  folders: string[];
}> {
  if (!imagekitEnabled()) return { files: 0, bytes: 0, folders };
  const client = getImageKit();
  let files = 0;
  let bytes = 0;

  for (const folder of folders) {
    const path = `/${folder.replace(/^\/+|\/+$/g, "")}/`;
    let skip = 0;
    for (let page = 0; page < 50; page++) {
      try {
        const assets = await client.assets.list({
          type: "file",
          path,
          limit: 100,
          skip,
        });
        const list = Array.isArray(assets) ? assets : [];
        if (list.length === 0) break;
        files += list.length;
        for (const f of list) {
          bytes += Number((f as { size?: number }).size || 0);
        }
        if (list.length < 100) break;
        skip += list.length;
      } catch {
        break;
      }
    }
  }

  return { files, bytes, folders };
}
