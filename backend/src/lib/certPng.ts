import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";
import { env } from "../config/env.js";
import { loadPhotoBytes } from "./studentPhoto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadLogoDataUri(): Promise<string> {
  try {
    const bytes = await readFile(path.resolve(__dirname, "../../assets/logo.png"));
    const round = await sharp(bytes)
      .resize(360, 360, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${round.toString("base64")}`;
  } catch {
    return "";
  }
}

async function loadRoundPhotoDataUri(photoUrl?: string | null): Promise<string> {
  const photo = await loadPhotoBytes({ photoUrl: photoUrl ?? undefined });
  if (!photo) return "";
  const size = 340;
  const circleSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  const round = await sharp(photo.bytes)
    .resize(size, size, { fit: "cover" })
    .composite([{ input: circleSvg, blend: "dest-in" }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${round.toString("base64")}`;
}

/** Template-faithful certificate PNG (matches on-screen CertificateArt + QR). */
export async function buildCertificateTemplatePng(opts: {
  publicId: string;
  displayName: string;
  course: string;
  type: string;
  issueDate: Date;
  status: string;
  photoUrl?: string | null;
}): Promise<Buffer> {
  const width = 1800;
  const height = 1272;
  const verifyUrl = `${env.PUBLIC_SITE_URL}/verify/${opts.publicId}`;
  const isCompletion = String(opts.type).toUpperCase() === "COMPLETION";
  const typeLabel = isCompletion ? "Certificate of Completion" : "Certificate of Participation";
  const dateLabel = opts.issueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const bodyText = isCompletion
    ? `Congratulations on successfully finishing the ${opts.course} with The Digital 26. We celebrate your dedication, your wins, and the bright craft ahead. Keep building with heart.`
    : `with a warm welcome into the ${opts.course}. You are part of The Digital 26, arriving with curiosity, good energy, and an open mind to learn, vibe, and grow. We're glad you're here.`;

  const [qr, logoUri, photoUri] = await Promise.all([
    QRCode.toBuffer(verifyUrl, {
      type: "png",
      margin: 1,
      width: 260,
      errorCorrectionLevel: "M",
      color: { dark: "#06060a", light: "#ffffff" },
    }),
    loadLogoDataUri(),
    loadRoundPhotoDataUri(opts.photoUrl),
  ]);
  const qrB64 = `data:image/png;base64,${Buffer.from(qr).toString("base64")}`;
  const verifyDisplay = verifyUrl.replace(/^https?:\/\//, "");

  // Fixed vertical rhythm so name never covers body text.
  const logoSize = 140;
  const photoSize = 140;
  const logoX = 80;
  const logoY = 44;
  const photoX = width - 80 - photoSize;
  const photoY = 44;

  const brandY = 230; // clear below corner images
  const presentsY = 280;
  const typeY = 350;
  const awardedY = 400;
  const nameStartY = 470;
  const nameLines = wrapText(opts.displayName, opts.displayName.length > 28 ? 22 : 30).slice(0, 2);
  const nameSize = nameLines.length > 1 || opts.displayName.length > 26 ? 54 : 68;
  const nameLineGap = nameSize + 8;
  const bodyStartY = nameStartY + nameLines.length * nameLineGap + 28;
  const bodyLines = wrapText(bodyText, 62).slice(0, 4);
  const bodySvg = bodyLines
    .map(
      (line, i) =>
        `<text x="50%" y="${bodyStartY + i * 36}" text-anchor="middle" fill="#a09888" font-family="Georgia, serif" font-size="28">${escapeXml(line)}</text>`,
    )
    .join("\n");
  const nameSvg = nameLines
    .map(
      (line, i) =>
        `<text x="50%" y="${nameStartY + i * nameLineGap}" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-size="${nameSize}" font-weight="700">${escapeXml(line)}</text>`,
    )
    .join("\n");

  const skillsY = Math.min(800, bodyStartY + bodyLines.length * 36 + 40);
  const skills = ["Vibe Coding", "Prompt Engineering", "Web Development", "Deployment"];
  const skillChips = skills
    .map((s, i) => {
      const x = 430 + i * 240;
      return `<rect x="${x}" y="${skillsY}" width="220" height="40" fill="none" stroke="#f0a500" stroke-opacity="0.35" rx="2"/>
        <text x="${x + 110}" y="${skillsY + 27}" text-anchor="middle" fill="#f0a500" font-family="Arial, sans-serif" font-size="16" letter-spacing="2">${escapeXml(s.toUpperCase())}</text>`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#f0a500" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#06060a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#06060a"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="#f0a500" stroke-opacity="0.35" stroke-width="2"/>
  <rect x="32" y="32" width="${width - 64}" height="${height - 64}" fill="none" stroke="#f0a500" stroke-opacity="0.12" stroke-width="1"/>

  <text x="50%" y="54%" text-anchor="middle" fill="#f0a500" fill-opacity="0.05" font-family="Arial Black, Arial, sans-serif" font-size="220" letter-spacing="8">D26</text>

  ${logoUri ? `<image x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="${logoUri}" />` : ""}
  ${photoUri
    ? `<circle cx="${photoX + photoSize / 2}" cy="${photoY + photoSize / 2}" r="${photoSize / 2 + 4}" fill="none" stroke="#f0a500" stroke-opacity="0.5" stroke-width="4"/>
       <image x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" href="${photoUri}" />`
    : `<circle cx="${photoX + photoSize / 2}" cy="${photoY + photoSize / 2}" r="${photoSize / 2}" fill="#111" stroke="#f0a500" stroke-opacity="0.35" stroke-width="3"/>`}

  <!-- Brand sits fully below corner images -->
  <line x1="420" y1="${brandY - 8}" x2="700" y2="${brandY - 8}" stroke="#f0a500" stroke-width="2"/>
  <text x="50%" y="${brandY}" text-anchor="middle" fill="#f0a500" font-family="Arial Black, Arial, sans-serif" font-size="30" font-weight="900" letter-spacing="8">THE DIGITAL 26</text>
  <line x1="1100" y1="${brandY - 8}" x2="1380" y2="${brandY - 8}" stroke="#f0a500" stroke-width="2"/>

  <text x="50%" y="${presentsY}" text-anchor="middle" fill="#6a6055" font-family="Georgia, serif" font-style="italic" font-size="22" letter-spacing="4">hereby proudly presents this</text>
  <text x="50%" y="${typeY}" text-anchor="middle" fill="#f0a500" font-family="Arial Black, Arial, sans-serif" font-size="56" letter-spacing="3">${escapeXml(typeLabel)}</text>
  <text x="50%" y="${awardedY}" text-anchor="middle" fill="#6a6055" font-family="Georgia, serif" font-style="italic" font-size="22" letter-spacing="4">awarded to</text>

  ${nameSvg}
  ${bodySvg}
  ${skillChips}

  <text x="280" y="970" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-style="italic" font-size="32">Adewuyi Ayuba</text>
  <line x1="160" y1="992" x2="400" y2="992" stroke="#f0a500" stroke-opacity="0.4" stroke-width="1.5"/>
  <text x="280" y="1024" text-anchor="middle" fill="#6a6055" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">INSTRUCTOR &amp; FOUNDER</text>
  <text x="280" y="1048" text-anchor="middle" fill="#6a6055" font-family="Arial, sans-serif" font-size="14">THE DIGITAL 26 BY MAXIM</text>
  <text x="280" y="1072" text-anchor="middle" fill="#6a6055" font-family="Arial, sans-serif" font-size="13">RC - 9710046</text>

  <rect x="${width / 2 - 78}" y="905" width="156" height="156" fill="#fff" rx="10"/>
  <image x="${width / 2 - 66}" y="917" width="132" height="132" href="${qrB64}"/>
  <text x="50%" y="1095" text-anchor="middle" fill="#f0a500" font-family="Arial, sans-serif" font-size="17" font-weight="700">${escapeXml(opts.publicId)}</text>

  <text x="${width - 280}" y="970" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-size="28" font-weight="600">${escapeXml(dateLabel)}</text>
  <line x1="${width - 400}" y1="992" x2="${width - 160}" y2="992" stroke="#f0a500" stroke-opacity="0.4" stroke-width="1.5"/>
  <text x="${width - 280}" y="1024" text-anchor="middle" fill="#6a6055" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">${isCompletion ? "DATE OF COMPLETION" : "DATE OF PARTICIPATION"}</text>
  <text x="${width - 280}" y="1056" text-anchor="middle" fill="#a07000" font-family="Arial, sans-serif" font-size="13">Verify: ${escapeXml(verifyDisplay)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}

/** @deprecated alias — admin 4K download now uses template layout */
export async function buildCertificatePng4k(opts: {
  publicId: string;
  displayName: string;
  course: string;
  type: string;
  issueDate: Date;
  status: string;
  photoUrl?: string | null;
}): Promise<Buffer> {
  return buildCertificateTemplatePng(opts);
}

export async function buildAgreementTemplatePng(opts: {
  publicId: string;
  displayName: string;
  dealTag?: string | null;
  signatureName: string;
  signedAt: Date;
}): Promise<Buffer> {
  const width = 1200;
  const height = 1600;
  const checkUrl = `${env.PUBLIC_SITE_URL}/check-agreement/${opts.publicId}`;
  const dateLabel = opts.signedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const tag = (opts.dealTag || "Services engagement").slice(0, 50);
  const [qr, logoUri] = await Promise.all([
    QRCode.toBuffer(checkUrl, {
      type: "png",
      margin: 1,
      width: 200,
      errorCorrectionLevel: "M",
      color: { dark: "#06060a", light: "#ffffff" },
    }),
    loadLogoDataUri(),
  ]);
  const qrB64 = `data:image/png;base64,${Buffer.from(qr).toString("base64")}`;
  const checkDisplay = checkUrl.replace(/^https?:\/\//, "");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0a0908"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#f0a500" stroke-opacity="0.35" stroke-width="2"/>
  <rect x="36" y="36" width="${width - 72}" height="${height - 72}" fill="none" stroke="#f0a500" stroke-opacity="0.12"/>

  ${logoUri ? `<image x="${width - 150}" y="70" width="80" height="80" href="${logoUri}" />` : ""}

  <text x="90" y="120" fill="#f0a500" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">THE DIGITAL 26</text>
  <text x="90" y="180" fill="#f0ebe0" font-family="Georgia, serif" font-size="42" font-weight="700">Service Agreement Letter</text>
  <text x="90" y="220" fill="#6a6055" font-family="Arial, sans-serif" font-size="16">${escapeXml(dateLabel)} · ${escapeXml(opts.publicId)}</text>

  <text x="90" y="300" fill="#cfc6b8" font-family="Georgia, serif" font-size="22">This letter records that <tspan fill="#f0ebe0" font-weight="700">${escapeXml(opts.displayName)}</tspan> has, based on our discussion,</text>
  <text x="90" y="332" fill="#cfc6b8" font-family="Georgia, serif" font-size="22">accepted and wants The Digital 26's services.</text>

  <text x="90" y="400" fill="#cfc6b8" font-family="Georgia, serif" font-size="22">About this engagement: <tspan fill="#f0ebe0" font-weight="700">${escapeXml(tag)}</tspan></text>

  <text x="90" y="480" fill="#a09888" font-family="Georgia, serif" font-size="20">By signing, the Client agrees to our consent, working terms, and service process, and</text>
  <text x="90" y="510" fill="#a09888" font-family="Georgia, serif" font-size="20">relies on The Digital 26 to deliver with honesty and care.</text>

  <text x="90" y="570" fill="#a09888" font-family="Georgia, serif" font-size="20">The Digital 26 upholds utmost truth and loyalty in our work. We condemn any form of</text>
  <text x="90" y="600" fill="#a09888" font-family="Georgia, serif" font-size="20">scam, fraud, or inappropriate conduct. We commit to give our best output and to dedicate</text>
  <text x="90" y="630" fill="#a09888" font-family="Georgia, serif" font-size="20">ourselves as much as we can to satisfy the Client.</text>

  <text x="90" y="690" fill="#a09888" font-family="Georgia, serif" font-size="20">Both parties believe we will not offend each other, and will manage the relationship with</text>
  <text x="90" y="720" fill="#a09888" font-family="Georgia, serif" font-size="20">respect throughout the whole service process Inshallah.</text>

  <text x="200" y="900" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-style="italic" font-size="30">${escapeXml(opts.signatureName)}</text>
  <line x1="90" y1="920" x2="310" y2="920" stroke="#f0a500" stroke-opacity="0.4"/>
  <text x="200" y="950" text-anchor="middle" fill="#6a6055" font-family="Arial, sans-serif" font-size="13">Client signature (typed name)</text>

  <text x="${width - 220}" y="900" text-anchor="middle" fill="#f0ebe0" font-family="Georgia, serif" font-style="italic" font-size="30">Adewuyi Ayuba</text>
  <line x1="${width - 340}" y1="920" x2="${width - 100}" y2="920" stroke="#f0a500" stroke-opacity="0.4"/>
  <text x="${width - 220}" y="950" text-anchor="middle" fill="#6a6055" font-family="Arial, sans-serif" font-size="13">The Digital 26 by Maxim</text>

  <rect x="${width / 2 - 90}" y="1100" width="180" height="180" fill="#fff" rx="10"/>
  <image x="${width / 2 - 80}" y="1110" width="160" height="160" href="${qrB64}"/>
  <text x="50%" y="1320" text-anchor="middle" fill="#f0a500" font-family="Arial, sans-serif" font-size="16" font-weight="700">${escapeXml(opts.publicId)}</text>
  <text x="50%" y="1355" text-anchor="middle" fill="#a07000" font-family="Arial, sans-serif" font-size="14">Check: ${escapeXml(checkDisplay)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
}
