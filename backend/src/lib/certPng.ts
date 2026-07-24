import QRCode from "qrcode";
import sharp from "sharp";
import { env } from "../config/env.js";
import { loadPhotoBytes } from "./studentPhoto.js";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildCertificatePng4k(opts: {
  publicId: string;
  displayName: string;
  course: string;
  type: string;
  issueDate: Date;
  status: string;
  photoUrl?: string | null;
}): Promise<Buffer> {
  const width = 4096;
  const height = 2896;
  const verifyUrl = `${env.PUBLIC_SITE_URL}/verify/${opts.publicId}`;
  const qr = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    margin: 1,
    width: 640,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  const typeLabel =
    String(opts.type).toUpperCase() === "COMPLETION"
      ? "Certificate of Completion"
      : "Certificate of Participation";
  const dateLabel = opts.issueDate.toISOString().slice(0, 10);

  let portraitDataUri = "";
  const photo = await loadPhotoBytes({ photoUrl: opts.photoUrl ?? undefined });
  if (photo) {
    const resized = await sharp(photo.bytes)
      .resize(900, 1100, { fit: "cover" })
      .jpeg({ quality: 92 })
      .toBuffer();
    portraitDataUri = `data:image/jpeg;base64,${resized.toString("base64")}`;
  }

  const qrB64 = `data:image/png;base64,${Buffer.from(qr).toString("base64")}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="55%" stop-color="#14110c"/>
      <stop offset="100%" stop-color="#1a1408"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="80" y="80" width="${width - 160}" height="${height - 160}" fill="none" stroke="#ff9e00" stroke-width="10"/>
  <rect x="110" y="110" width="${width - 220}" height="${height - 220}" fill="none" stroke="#ff9e00" stroke-width="2" opacity="0.45"/>
  <text x="50%" y="320" text-anchor="middle" fill="#ff9e00" font-family="Georgia, serif" font-size="96" letter-spacing="8">THE DIGITAL 26</text>
  <text x="50%" y="430" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-size="72">${escapeXml(typeLabel)}</text>
  <text x="50%" y="540" text-anchor="middle" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="42">Vibe Coding Studio &amp; Classroom</text>
  <text x="50%" y="720" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-size="110" font-weight="700">${escapeXml(opts.displayName)}</text>
  <text x="50%" y="820" text-anchor="middle" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="40">has completed</text>
  <text x="50%" y="920" text-anchor="middle" fill="#ff9e00" font-family="Georgia, serif" font-size="56">${escapeXml(opts.course)}</text>
  <text x="50%" y="1040" text-anchor="middle" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="36">Issue date ${escapeXml(dateLabel)} · Status ${escapeXml(opts.status)}</text>
  <text x="50%" y="1140" text-anchor="middle" fill="#f0ebe0" font-family="Arial, sans-serif" font-size="34">ID ${escapeXml(opts.publicId)}</text>
  ${
    portraitDataUri
      ? `<image x="${width / 2 - 280}" y="1220" width="560" height="680" href="${portraitDataUri}" preserveAspectRatio="xMidYMid slice"/>`
      : ""
  }
  <image x="${width - 860}" y="${height - 900}" width="640" height="640" href="${qrB64}"/>
  <text x="${width - 540}" y="${height - 220}" text-anchor="middle" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="28">Scan to verify</text>
  <text x="200" y="${height - 200}" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="28">${escapeXml(verifyUrl)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 6, quality: 100 }).toBuffer();
}
