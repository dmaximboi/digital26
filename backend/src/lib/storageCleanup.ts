import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { cacheDelPattern, cacheStats } from "./cache.js";
import {
  deleteImageKitUrls,
  imagekitEnabled,
  listImageKitStats,
  purgeImageKitFolders,
} from "./imagekit.js";

function uploadsRoot(): string {
  return env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
}

function imageKitFolders(): string[] {
  const base = (env.IMAGEKIT_FOLDER || "digital26/students").replace(/\/$/, "");
  const parent = base.includes("/") ? base.split("/")[0]! : "digital26";
  return [base, `${parent}/evidence`, `${parent}/students`];
}

async function wipeLocalUploads(): Promise<number> {
  const root = uploadsRoot();
  let removed = 0;
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      try {
        await rm(full, { recursive: true, force: true });
        removed += 1;
      } catch {}
    }
  } catch {}
  return removed;
}

export async function getStorageStats() {
  const [
    certificates,
    agreements,
    evidence,
    students,
    people,
    visits,
    otps,
    contact,
    chat,
    users,
  ] = await Promise.all([
    prisma.certificate.count(),
    prisma.agreement.count(),
    prisma.evidenceImage.count(),
    prisma.studentProfile.count(),
    prisma.person.count(),
    prisma.siteVisit.count(),
    prisma.emailOtp.count(),
    prisma.contactMessage.count(),
    prisma.chatMessage.count(),
    prisma.user.count(),
  ]);

  const imagekit = await listImageKitStats(imageKitFolders());

  return {
    database: {
      certificates,
      agreements,
      evidence,
      students,
      people,
      visits,
      otps,
      contact,
      chat,
      users,
    },
    cache: cacheStats(),
    imagekit: {
      enabled: imagekitEnabled(),
      ...imagekit,
      bytesMb: Math.round((imagekit.bytes / (1024 * 1024)) * 100) / 100,
    },
  };
}

export async function runStorageMaintenance(): Promise<{
  expiredOtps: number;
  oldVisits: number;
  cacheCleared: boolean;
  note: string;
}> {
  const otpCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const visitCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [otpResult, visitResult] = await Promise.all([
    prisma.emailOtp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { createdAt: { lt: otpCutoff } },
        ],
      },
    }),
    prisma.siteVisit.deleteMany({
      where: { createdAt: { lt: visitCutoff } },
    }),
  ]);

  cacheDelPattern("");
  cacheDelPattern("cert:");
  cacheDelPattern("agreement:");

  return {
    expiredOtps: otpResult.count,
    oldVisits: visitResult.count,
    cacheCleared: true,
    note: "Cleared expired OTPs, visits older than 30 days, and in-memory cache to reduce DB egress.",
  };
}

export async function wipeContentKeepAdmins(): Promise<{
  imagekitDeleted: number;
  imagekitFolderPurge: { deleted: number; errors: number };
  localFoldersRemoved: number;
  deleted: Record<string, number>;
}> {
  const [evidence, certs, agreements, students] = await Promise.all([
    prisma.evidenceImage.findMany({ select: { url: true } }),
    prisma.certificate.findMany({ select: { photoUrl: true } }),
    prisma.agreement.findMany({ select: { photoUrl: true } }),
    prisma.studentProfile.findMany({ select: { photoUrl: true } }),
  ]);

  const urls = [
    ...evidence.map((e) => e.url),
    ...certs.map((c) => c.photoUrl),
    ...agreements.map((a) => a.photoUrl),
    ...students.map((s) => s.photoUrl),
  ];

  const imagekitDeleted = await deleteImageKitUrls(urls);
  const imagekitFolderPurge = await purgeImageKitFolders(imageKitFolders());

  const deleted: Record<string, number> = {};

  deleted.evidence = (await prisma.evidenceImage.deleteMany({})).count;
  deleted.certificatePublic = (await prisma.certificatePublic.deleteMany({})).count;
  deleted.certificates = (await prisma.certificate.deleteMany({})).count;
  deleted.agreementPublic = (await prisma.agreementPublic.deleteMany({})).count;
  deleted.agreements = (await prisma.agreement.deleteMany({})).count;
  deleted.people = (await prisma.person.deleteMany({})).count;
  deleted.studentMessages = (await prisma.studentMessage.deleteMany({})).count;
  deleted.attendance = (await prisma.attendance.deleteMany({})).count;
  deleted.studentProfiles = (await prisma.studentProfile.deleteMany({})).count;
  deleted.chatMessages = (await prisma.chatMessage.deleteMany({})).count;
  deleted.contactMessages = (await prisma.contactMessage.deleteMany({})).count;
  deleted.siteVisits = (await prisma.siteVisit.deleteMany({})).count;
  deleted.emailOtps = (await prisma.emailOtp.deleteMany({})).count;
  deleted.auditLogs = (await prisma.adminAuditLog.deleteMany({})).count;

  const adminEmails = new Set(env.adminEmails.map((e) => e.toLowerCase()));
  const readonlyEmails = new Set(env.readonlyEmails.map((e) => e.toLowerCase()));

  const studentUsers = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, email: true },
  });

  const toDelete = studentUsers
    .filter((u) => !adminEmails.has(u.email.toLowerCase()) && !readonlyEmails.has(u.email.toLowerCase()))
    .map((u) => u.id);

  if (toDelete.length) {
    deleted.studentUsers = (
      await prisma.user.deleteMany({ where: { id: { in: toDelete } } })
    ).count;
  } else {
    deleted.studentUsers = 0;
  }

  const localFoldersRemoved = await wipeLocalUploads();
  cacheDelPattern("cert:");
  cacheDelPattern("agreement:");

  return {
    imagekitDeleted,
    imagekitFolderPurge,
    localFoldersRemoved,
    deleted,
  };
}
