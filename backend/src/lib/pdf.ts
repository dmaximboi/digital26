import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { env } from "../config/env.js";
import { loadPhotoBytes } from "./studentPhoto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLD = rgb(240 / 255, 165 / 255, 0);
const BLACK = rgb(0.02, 0.02, 0.04);
const CREAM = rgb(240 / 255, 235 / 255, 224 / 255);
const MUTED = rgb(0.42, 0.38, 0.33);

function uploadsRoot(): string {
  return env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function qrPng(url: string): Promise<Uint8Array> {
  const buf = await QRCode.toBuffer(url, {
    type: "png",
    margin: 1,
    width: 180,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  return new Uint8Array(buf);
}

async function embedLogo(pdf: PDFDocument) {
  const logoPath = path.resolve(__dirname, "../../assets/logo.png");
  try {
    const bytes = await readFile(logoPath);
    return pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export async function buildAgreementPdf(opts: {
  publicId: string;
  displayName: string;
  dealType: string;
  dealTag?: string | null;
  signatureName: string;
  signedAt: Date;
  terms: string;
}): Promise<{ bytes: Uint8Array; filePath: string; publicUrl: string }> {
  const verifyUrl = `${env.PUBLIC_SITE_URL}/check-agreement/${opts.publicId}`;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logo = await embedLogo(pdf);

  if (logo) {
    page.drawImage(logo, { x: 50, y: 760, width: 56, height: 56 });
    page.drawCircle({
      x: 78,
      y: 788,
      size: 30,
      borderColor: GOLD,
      borderWidth: 2,
    });
  }

  page.drawText("THE DIGITAL 26", {
    x: logo ? 130 : 50,
    y: 800,
    size: 16,
    font: bold,
    color: GOLD,
  });
  page.drawText("Service Agreement Letter", {
    x: logo ? 130 : 50,
    y: 780,
    size: 12,
    font: bold,
    color: BLACK,
  });
  page.drawText("Website · Collaboration · Digital services", {
    x: logo ? 130 : 50,
    y: 762,
    size: 9,
    font,
    color: MUTED,
  });

  const tag = (opts.dealTag || "Services engagement").slice(0, 50);
  const lines = [
    `Public ID: ${opts.publicId}`,
    `Client: ${opts.displayName}`,
    `About: ${tag}`,
    `Signed: ${opts.signedAt.toLocaleString("en-GB")}`,
    `Signature: ${opts.signatureName}`,
    `Check: ${verifyUrl}`,
  ];

  let y = 720;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font, color: BLACK });
    y -= 18;
  }

  y -= 10;
  page.drawText("Terms snapshot", { x: 50, y, size: 12, font: bold, color: GOLD });
  y -= 16;

  const termsLines = wrapText(opts.terms.replace(/\s+/g, " ").trim(), 88);
  for (const line of termsLines.slice(0, 28)) {
    page.drawText(line, { x: 50, y, size: 9, font, color: MUTED });
    y -= 12;
    if (y < 160) break;
  }

  page.drawText(opts.signatureName, {
    x: 50,
    y: 120,
    size: 16,
    font: italic,
    color: BLACK,
  });
  page.drawText("Digital signature", {
    x: 50,
    y: 104,
    size: 9,
    font,
    color: MUTED,
  });

  const qr = await qrPng(verifyUrl);
  const qrImage = await pdf.embedPng(qr);
  page.drawImage(qrImage, { x: 420, y: 70, width: 120, height: 120 });

  const bytes = await pdf.save();
  const dir = path.join(uploadsRoot(), "agreements");
  await ensureDir(dir);
  const filePath = path.join(dir, `${opts.publicId}.pdf`);
  await writeFile(filePath, bytes);

  return {
    bytes,
    filePath,
    publicUrl: `${env.API_URL}/api/ops/files/agreements/${opts.publicId}.pdf`,
  };
}

export async function buildCertificatePdf(opts: {
  publicId: string;
  displayName: string;
  course: string;
  type: string;
  issueDate: Date;
  status: string;
  photoPath?: string;
  photoUrl?: string;
}): Promise<{ bytes: Uint8Array; filePath: string; publicUrl: string }> {
  const verifyUrl = `${env.PUBLIC_SITE_URL}/verify/${opts.publicId}`;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([900, 636]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const logo = await embedLogo(pdf);

  page.drawRectangle({ x: 0, y: 0, width, height, color: BLACK });
  page.drawRectangle({
    x: 10,
    y: 10,
    width: width - 20,
    height: height - 20,
    borderColor: GOLD,
    borderWidth: 1,
    borderOpacity: 0.4,
  });
  page.drawRectangle({
    x: 16,
    y: 16,
    width: width - 32,
    height: height - 32,
    borderColor: GOLD,
    borderWidth: 1,
    borderOpacity: 0.15,
  });

  if (logo) {
    
    const lx = 72;
    const ly = height - 100;
    const ls = 64;
    page.drawImage(logo, { x: lx, y: ly, width: ls, height: ls });
    page.drawCircle({
      x: lx + ls / 2,
      y: ly + ls / 2,
      size: ls / 2 + 2,
      borderColor: GOLD,
      borderWidth: 2.5,
    });
  }

  if (opts.photoPath || opts.photoUrl) {
    try {
      const loaded = await loadPhotoBytes({
        photoPath: opts.photoPath,
        photoUrl: opts.photoUrl,
      });
      if (loaded) {
        const photo =
          loaded.kind === "png"
            ? await pdf.embedPng(loaded.bytes)
            : await pdf.embedJpg(loaded.bytes);
        page.drawImage(photo, {
          x: width - 144,
          y: height - 112,
          width: 64,
          height: 76,
        });
      }
    } catch {
      
    }
  }

  page.drawText("THE DIGITAL 26", {
    x: width / 2 - 110,
    y: height - 70,
    size: 9,
    font: bold,
    color: GOLD,
  });

  page.drawText("hereby proudly presents this", {
    x: width / 2 - 80,
    y: height - 120,
    size: 11,
    font,
    color: MUTED,
  });

  const title =
    opts.type === "COMPLETION"
      ? "CERTIFICATE OF COMPLETION"
      : "CERTIFICATE OF PARTICIPATION";

  page.drawText(title, {
    x: width / 2 - (title.length * 7) / 2,
    y: height - 160,
    size: 22,
    font: bold,
    color: GOLD,
  });

  page.drawText("awarded to", {
    x: width / 2 - 35,
    y: height - 195,
    size: 11,
    font,
    color: MUTED,
  });

  const nameSize = opts.displayName.length > 28 ? 26 : 34;
  page.drawText(opts.displayName, {
    x: Math.max(80, width / 2 - opts.displayName.length * (nameSize * 0.28)),
    y: height - 245,
    size: nameSize,
    font: serif,
    color: CREAM,
  });

  const body =
    opts.type === "COMPLETION"
      ? `Congratulations on successfully finishing the ${opts.course}`
      : `with a warm welcome into the ${opts.course}`;
  page.drawText(body, {
    x: 120,
    y: height - 290,
    size: 11,
    font,
    color: MUTED,
  });
  page.drawText(
    opts.type === "COMPLETION"
      ? "with The Digital 26. Celebrate your wins and keep building with heart."
      : "You are part of The Digital 26. Curiosity, energy, and growth. We're glad you're here.",
    {
      x: 120,
      y: height - 308,
      size: 11,
      font,
      color: MUTED,
    },
  );

  const skills = ["Vibe Coding", "Prompt Engineering", "Web Development", "Deployment"];
  let sx = 200;
  for (const skill of skills) {
    page.drawRectangle({
      x: sx,
      y: height - 350,
      width: skill.length * 6 + 16,
      height: 16,
      borderColor: GOLD,
      borderWidth: 1,
      borderOpacity: 0.4,
    });
    page.drawText(skill.toUpperCase(), {
      x: sx + 8,
      y: height - 345,
      size: 7,
      font,
      color: GOLD,
    });
    sx += skill.length * 6 + 28;
  }

  page.drawText("Adewuyi Ayuba", {
    x: 90,
    y: 110,
    size: 14,
    font: serif,
    color: CREAM,
  });
  page.drawText("Instructor & Founder · The Digital 26 by Maxim", {
    x: 90,
    y: 92,
    size: 8,
    font,
    color: MUTED,
  });

  const dateStr = opts.issueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  page.drawText(dateStr, {
    x: width - 260,
    y: 110,
    size: 12,
    font: bold,
    color: CREAM,
  });
  page.drawText(
    opts.type === "COMPLETION" ? "Date of Completion" : "Date of Participation",
    {
      x: width - 260,
      y: 92,
      size: 8,
      font,
      color: MUTED,
    },
  );

  page.drawText(opts.publicId, {
    x: width / 2 - 45,
    y: 70,
    size: 9,
    font: bold,
    color: GOLD,
  });

  const qr = await qrPng(verifyUrl);
  const qrImage = await pdf.embedPng(qr);
  page.drawImage(qrImage, { x: width / 2 - 36, y: 100, width: 72, height: 72 });

  page.drawText(`Status: ${opts.status}`, {
    x: 90,
    y: 48,
    size: 8,
    font,
    color: MUTED,
  });

  const verifyLabel = `Verify: ${verifyUrl.replace(/^https?:\/\//, "")}`;
  page.drawText(verifyLabel, {
    x: Math.max(90, width / 2 - verifyLabel.length * 2.4),
    y: 32,
    size: 8,
    font,
    color: GOLD,
  });

  const bytes = await pdf.save();
  const dir = path.join(uploadsRoot(), "certificates");
  await ensureDir(dir);
  const filePath = path.join(dir, `${opts.publicId}.pdf`);
  await writeFile(filePath, bytes);

  return {
    bytes,
    filePath,
    publicUrl: `${env.API_URL}/api/ops/files/certificates/${opts.publicId}.pdf`,
  };
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
