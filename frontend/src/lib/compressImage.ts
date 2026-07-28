const TARGET_BYTES = 300 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressImage(
  file: File,
  opts: { maxWidth?: number; maxHeight?: number; maxBytes?: number } = {},
): Promise<File> {
  const maxBytes = opts.maxBytes ?? TARGET_BYTES;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }

  const bitmap = await createImageBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  let width = Math.min(srcW, opts.maxWidth ?? 900);
  let height = Math.min(srcH, opts.maxHeight ?? 1100);
  const fit = Math.min(1, width / srcW, height / srcH);
  width = Math.max(1, Math.round(srcW * fit));
  height = Math.max(1, Math.round(srcH * fit));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process image");
  }

  let blob: Blob | null = null;
  let quality = 0.82;

  for (let attempt = 0; attempt < 14; attempt++) {
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    blob = await canvasToBlob(canvas, quality);

    if (blob.size <= maxBytes) break;

    if (quality > 0.4) {
      quality = Math.max(0.38, quality - 0.08);
    } else {
      width = Math.max(180, Math.round(width * 0.82));
      height = Math.max(180, Math.round(height * 0.82));
      quality = 0.7;
    }
  }

  bitmap.close();

  if (!blob || blob.size > maxBytes) {
    throw new Error("Image could not be compressed to 300KB. Try a smaller photo.");
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
