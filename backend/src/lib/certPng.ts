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
  const dateLabel = opts.issueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let portraitDataUri = "";
  const photo = await loadPhotoBytes({ photoUrl: opts.photoUrl ?? undefined });
  if (photo) {
    const resized = await sharp(photo.bytes)
      .resize(560, 680, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
    portraitDataUri = `data:image/jpeg;base64,${resized.toString("base64")}`;
  }

  const qrB64 = `data:image/png;base64,${Buffer.from(qr).toString("base64")}`;
  const bodyText = String(opts.type).toUpperCase() === "COMPLETION"
    ? `Congratulations on successfully finishing the ${escapeXml(opts.course)} with The Digital 26.`
    : `With a warm welcome into the ${escapeXml(opts.course)}. You are part of The Digital 26.`;

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

  <!-- Brand -->
  <text x="50%" y="320" text-anchor="middle" fill="#ff9e00" font-family="Georgia, serif" font-size="96" letter-spacing="8">THE DIGITAL 26</text>
  <text x="50%" y="400" text-anchor="middle" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="32">Vibe Coding Studio &amp; Classroom · RC - 9710046</text>

  <!-- Title -->
  <text x="50%" y="540" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-size="72">${escapeXml(typeLabel)}</text>
  <text x="50%" y="630" text-anchor="middle" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="42">awarded to</text>

  <!-- Name -->
  <text x="50%" y="780" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-size="110" font-weight="700">${escapeXml(opts.displayName)}</text>

  <!-- Body -->
  <text x="50%" y="900" text-anchor="middle" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="36">${bodyText}</text>

  <!-- Skills -->
  <text x="50%" y="1020" text-anchor="middle" fill="#ff9e00" font-family="Arial, sans-serif" font-size="30" letter-spacing="6">VIBE CODING · PROMPT ENGINEERING · WEB DEVELOPMENT · DEPLOYMENT</text>

  <!-- Portrait -->
  ${portraitDataUri
    ? `<rect x="${width / 2 - 290}" y="1100" width="580" height="720" rx="16" fill="#1a1408"/>
       <image x="${width / 2 - 280}" y="1110" width="560" height="700" href="${portraitDataUri}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 12px)"/>`
    : ""}

  <!-- Signature left -->
  <text x="400" y="${height - 500}" fill="#f0ebe0" font-family="Georgia, serif" font-style="italic" font-size="56">Adewuyi Ayuba</text>
  <line x1="300" y1="${height - 470}" x2="800" y2="${height - 470}" stroke="#ff9e00" stroke-width="2" opacity="0.5"/>
  <text x="400" y="${height - 430}" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="28">Instructor &amp; Founder · The Digital 26 by Maxim</text>
  <text x="400" y="${height - 390}" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="24">RC - 9710046</text>

  <!-- Date right -->
  <text x="${width - 400}" y="${height - 500}" text-anchor="end" fill="#f0ebe0" font-family="Georgia, serif" font-size="48">${escapeXml(dateLabel)}</text>
  <line x1="${width - 800}" y1="${height - 470}" x2="${width - 300}" y2="${height - 470}" stroke="#ff9e00" stroke-width="2" opacity="0.5"/>
  <text x="${width - 400}" y="${height - 430}" text-anchor="end" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="28">${String(opts.type).toUpperCase() === "COMPLETION" ? "Date of Completion" : "Date of Participation"}</text>

  <!-- QR -->
  <rect x="${width / 2 - 340}" y="${height - 340}" width="680" height="200" rx="12" fill="#111"/>
  <image x="${width / 2 - 80}" y="${height - 320}" width="160" height="160" href="${qrB64}"/>
  <text x="${width / 2}" y="${height - 130}" text-anchor="middle" fill="#ff9e00" font-family="Arial, sans-serif" font-size="32" font-weight="700">${escapeXml(opts.publicId)}</text>

  <!-- Footer -->
  <text x="200" y="${height - 130}" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="24">Status: ${escapeXml(opts.status)}</text>
  <text x="${width - 200}" y="${height - 130}" text-anchor="end" fill="#b8b0a4" font-family="Arial, sans-serif" font-size="24">${escapeXml(verifyUrl)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 6, quality: 100 }).toBuffer();
}
