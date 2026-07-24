import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { env } from "../config/env.js";
import { loadPhotoBytes } from "./studentPhoto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLD = rgb(240 / 255, 165 / 255, 0);
const BLACK = rgb(0.02, 0.02, 0.04);
const CREAM = rgb(240 / 255, 235 / 255, 224 / 255);
const MUTED = rgb(0.42, 0.38, 0.33);
const PAPER = rgb(0.985, 0.978, 0.965);
const INK = rgb(0.09, 0.09, 0.1);
const INK_SOFT = rgb(0.28, 0.27, 0.25);
const RULE = rgb(0.82, 0.78, 0.72);
const SIDEBAR = rgb(0.05, 0.05, 0.06);
const CHIP_BG = rgb(0.96, 0.93, 0.88);

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
  const checkDisplay = verifyUrl.replace(/^https?:\/\//, "");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const logo = await embedLogo(pdf);

  const sidebarW = 168;
  const marginR = 36;
  const contentX = sidebarW + 28;
  const contentW = width - contentX - marginR;
  const tag = (opts.dealTag || "Services engagement").slice(0, 72);
  const signedLabel = opts.signedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Paper + left brand sidebar (resume layout)
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });
  page.drawRectangle({ x: 0, y: 0, width: sidebarW, height, color: SIDEBAR });
  page.drawRectangle({
    x: sidebarW - 3,
    y: 0,
    width: 3,
    height,
    color: GOLD,
  });

  // Sidebar brand
  if (logo) {
    const ls = 64;
    const lx = (sidebarW - ls) / 2;
    const ly = height - 108;
    page.drawImage(logo, { x: lx, y: ly, width: ls, height: ls });
    page.drawCircle({
      x: lx + ls / 2,
      y: ly + ls / 2,
      size: ls / 2 + 3,
      borderColor: GOLD,
      borderWidth: 2,
    });
  }

  drawCentered(page, "THE DIGITAL 26", {
    x: sidebarW / 2,
    y: height - 140,
    size: 9,
    font: bold,
    color: GOLD,
  });
  drawWrapped(page, "Vibe Coding Studio & Classroom", {
    x: 18,
    y: height - 162,
    maxWidth: sidebarW - 36,
    size: 8,
    font,
    color: CREAM,
    lineHeight: 11,
    align: "center",
    centerWidth: sidebarW,
  });

  // Sidebar meta chips
  let sy = height - 210;
  const sidebarMeta: Array<[string, string]> = [
    ["DOCUMENT", "Service Agreement"],
    ["PUBLIC ID", opts.publicId],
    ["SIGNED", signedLabel],
    ["STATUS", "Executed"],
  ];
  for (const [label, value] of sidebarMeta) {
    page.drawText(label, {
      x: 18,
      y: sy,
      size: 7,
      font: bold,
      color: GOLD,
    });
    sy -= 12;
    const valueLines = wrapTextToWidth(value, font, 9, sidebarW - 36);
    for (const line of valueLines) {
      page.drawText(line, { x: 18, y: sy, size: 9, font, color: CREAM });
      sy -= 12;
    }
    sy -= 14;
  }

  page.drawText("VERIFY ONLINE", {
    x: 18,
    y: 168,
    size: 7,
    font: bold,
    color: GOLD,
  });
  const qr = await qrPng(verifyUrl);
  const qrImage = await pdf.embedPng(qr);
  page.drawRectangle({
    x: 22,
    y: 48,
    width: 124,
    height: 124,
    color: rgb(1, 1, 1),
  });
  page.drawImage(qrImage, { x: 28, y: 54, width: 112, height: 112 });
  page.drawText("Scan to open public record", {
    x: 18,
    y: 34,
    size: 7,
    font,
    color: MUTED,
  });

  // Main column — resume header
  let y = height - 56;
  page.drawText("SERVICE AGREEMENT LETTER", {
    x: contentX,
    y,
    size: 18,
    font: serifBold,
    color: INK,
  });
  y -= 18;
  page.drawText("Digital presence · Websites · Collaboration", {
    x: contentX,
    y,
    size: 9,
    font,
    color: INK_SOFT,
  });
  y -= 14;
  page.drawRectangle({
    x: contentX,
    y,
    width: contentW,
    height: 1.5,
    color: GOLD,
  });
  y -= 28;

  // Profile-style identity block
  page.drawText(asciiPdf(opts.displayName.toUpperCase()), {
    x: contentX,
    y,
    size: Math.min(20, Math.max(14, 26 - opts.displayName.length * 0.25)),
    font: bold,
    color: INK,
  });
  y -= 16;
  page.drawText("Client · Counterparty to this letter", {
    x: contentX,
    y,
    size: 9,
    font,
    color: INK_SOFT,
  });
  y -= 22;

  // Two-column fact grid (resume contact strip)
  const colGap = 16;
  const colW = (contentW - colGap) / 2;
  const facts: Array<[string, string]> = [
    ["Engagement", asciiPdf(tag)],
    ["Deal type", humanDealType(opts.dealType)],
    ["Signature name", asciiPdf(opts.signatureName)],
    ["Issued by", "Adewuyi Ayuba (Maxim)"],
  ];
  for (let i = 0; i < facts.length; i += 2) {
    const left = facts[i]!;
    const right = facts[i + 1];
    drawFact(page, left[0], left[1], contentX, y, colW, font, bold);
    if (right) {
      drawFact(page, right[0], right[1], contentX + colW + colGap, y, colW, font, bold);
    }
    y -= 36;
  }

  y -= 4;
  drawSectionRule(page, contentX, y, contentW, "SUMMARY", bold);
  y -= 22;

  const summaryParas = [
    `This letter records that ${opts.displayName} has, based on our discussion, accepted and wants The Digital 26's services.`,
    `About this engagement: ${tag}.`,
  ];
  for (const para of summaryParas) {
    y = drawParagraph(page, asciiPdf(para), {
      x: contentX,
      y,
      maxWidth: contentW,
      size: 10,
      font,
      color: INK_SOFT,
      lineHeight: 14,
    });
    y -= 10;
  }

  // Highlight chip
  page.drawRectangle({
    x: contentX,
    y: y - 28,
    width: contentW,
    height: 34,
    color: CHIP_BG,
  });
  page.drawRectangle({
    x: contentX,
    y: y - 28,
    width: 3,
    height: 34,
    color: GOLD,
  });
  drawWrapped(
    page,
    asciiPdf(
      "By signing, the Client agrees to consent, working terms, and service process - and relies on The Digital 26 to deliver with honesty and care.",
    ),
    {
      x: contentX + 10,
      y: y - 8,
      maxWidth: contentW - 18,
      size: 8.5,
      font,
      color: INK,
      lineHeight: 11,
    },
  );
  y -= 48;

  drawSectionRule(page, contentX, y, contentW, "TERMS & COMMITMENTS", bold);
  y -= 20;

  const termBlocks = splitTerms(opts.terms);
  for (const block of termBlocks) {
    if (y < 170) break;
    page.drawCircle({
      x: contentX + 3,
      y: y + 3,
      size: 2.2,
      color: GOLD,
    });
    y = drawParagraph(page, asciiPdf(block), {
      x: contentX + 12,
      y,
      maxWidth: contentW - 12,
      size: 9,
      font,
      color: INK_SOFT,
      lineHeight: 12.5,
    });
    y -= 12;
  }

  if (y > 148) y = 148;
  drawSectionRule(page, contentX, y, contentW, "SIGNATURES", bold);
  y -= 28;

  const sigW = (contentW - 24) / 2;
  // Client signature
  page.drawText(asciiPdf(opts.signatureName), {
    x: contentX,
    y,
    size: 14,
    font: italic,
    color: INK,
  });
  page.drawRectangle({
    x: contentX,
    y: y - 8,
    width: Math.min(sigW - 8, 160),
    height: 0.8,
    color: RULE,
  });
  page.drawText("CLIENT DIGITAL SIGNATURE", {
    x: contentX,
    y: y - 22,
    size: 7,
    font: bold,
    color: MUTED,
  });
  page.drawText(`Typed name · ${signedLabel}`, {
    x: contentX,
    y: y - 34,
    size: 8,
    font,
    color: INK_SOFT,
  });

  // Studio signature
  const sx2 = contentX + sigW + 24;
  page.drawText("Adewuyi Ayuba", {
    x: sx2,
    y,
    size: 14,
    font: italic,
    color: INK,
  });
  page.drawRectangle({
    x: sx2,
    y: y - 8,
    width: Math.min(sigW - 8, 160),
    height: 0.8,
    color: RULE,
  });
  page.drawText("THE DIGITAL 26 BY MAXIM", {
    x: sx2,
    y: y - 22,
    size: 7,
    font: bold,
    color: MUTED,
  });
  page.drawText("Founder & Instructor", {
    x: sx2,
    y: y - 34,
    size: 8,
    font,
    color: INK_SOFT,
  });

  // Footer verify line
  page.drawRectangle({
    x: contentX,
    y: 28,
    width: contentW,
    height: 0.6,
    color: RULE,
  });
  page.drawText(`Public check · ${checkDisplay}`, {
    x: contentX,
    y: 16,
    size: 7.5,
    font,
    color: GOLD,
  });

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

function asciiPdf(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

function humanDealType(dealType: string): string {
  switch (dealType) {
    case "BUY_PRODUCT":
      return "Digital product";
    case "LEARN_SKILLS":
      return "Skills / collaboration";
    default:
      return "Services engagement";
  }
}

function splitTerms(terms: string): string[] {
  const cleaned = terms
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((p) => !/^THE DIGITAL 26/i.test(p));
  if (cleaned.length >= 2) return cleaned.slice(0, 6);
  // Fallback: sentence-split a single blob
  return terms
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 5);
}

function drawSectionRule(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  title: string,
  bold: PDFFont,
): void {
  page.drawText(title, { x, y, size: 9, font: bold, color: GOLD });
  const tw = bold.widthOfTextAtSize(title, 9);
  page.drawRectangle({
    x: x + tw + 10,
    y: y + 3,
    width: Math.max(24, w - tw - 10),
    height: 0.7,
    color: RULE,
  });
}

function drawFact(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number,
  font: PDFFont,
  bold: PDFFont,
): void {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    size: 7,
    font: bold,
    color: MUTED,
  });
  const lines = wrapTextToWidth(value, font, 10, maxW);
  let cy = y - 13;
  for (const line of lines.slice(0, 2)) {
    page.drawText(line, { x, y: cy, size: 10, font, color: INK });
    cy -= 12;
  }
}

function drawCentered(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
  },
): void {
  const tw = opts.font.widthOfTextAtSize(text, opts.size);
  page.drawText(text, {
    x: opts.x - tw / 2,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
  });
}

function wrapTextToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawWrapped(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    lineHeight: number;
    align?: "left" | "center";
    centerWidth?: number;
  },
): number {
  const lines = wrapTextToWidth(text, opts.font, opts.size, opts.maxWidth);
  let y = opts.y;
  for (const line of lines) {
    let x = opts.x;
    if (opts.align === "center" && opts.centerWidth) {
      const tw = opts.font.widthOfTextAtSize(line, opts.size);
      x = (opts.centerWidth - tw) / 2;
    }
    page.drawText(line, {
      x,
      y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
    y -= opts.lineHeight;
  }
  return y;
}

function drawParagraph(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    lineHeight: number;
  },
): number {
  return drawWrapped(page, text, { ...opts, align: "left" });
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
