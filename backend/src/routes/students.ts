import { Router } from "express";
import { z } from "zod";
import { ProgrammeType, StudentStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireAdmin, requireAdminWrite } from "../middleware/requireAuth.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { compressAndStoreStudentPhoto } from "../lib/studentPhoto.js";
import { authLimiter } from "../middleware/security.js";
import { issueEmailOtp, verifyEmailOtp } from "../lib/otp.js";
import { sendOtpEmail } from "../lib/mail.js";
import { writeAudit } from "../lib/audit.js";
import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { env } from "../config/env.js";

export const studentsRouter = Router();

const uploadDir = path.resolve(
  env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads"),
  "students",
);
mkdirSync(uploadDir, { recursive: true });

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
      return;
    }
    cb(null, true);
  },
});

studentsRouter.post(
  "/student/apply/otp",
  authLimiter,
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const email = req.userEmail;
      if (!email) {
        res.status(400).json({ error: "Email not found" });
        return;
      }

      const existing = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
      });
      if (existing) {
        res.status(409).json({ error: "You have already submitted an application" });
        return;
      }

      const issued = await issueEmailOtp({
        email: email.toLowerCase(),
        purpose: "student_apply",
      });
      if ("error" in issued) {
        res.status(429).json({ error: issued.error });
        return;
      }

      await sendOtpEmail({ to: email, code: issued.code });
      res.json({ ok: true, message: "Verification code sent to your email" });
    } catch (err) {
      console.error("[student.apply.otp]", err);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  },
);

const applySchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(5).max(32),
  parentPhone: z.string().min(5).max(32).optional(),
  address: z.string().min(5).max(500).optional(),
  programme: z.nativeEnum(ProgrammeType),
  classMode: z.enum(["PHYSICAL", "ONLINE"]).default("PHYSICAL"),
  otpCode: z.string().regex(/^\d{6}$/),
});

studentsRouter.post(
  "/student/apply",
  authLimiter,
  requireAuth,
  (req, res, next) => {
    photoUpload.single("photo")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Photo upload failed" });
        return;
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    try {
      const parsed = applySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid application data. Make sure all fields and OTP code are filled." });
        return;
      }

      const existing = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
      });
      if (existing) {
        res.status(409).json({ error: "You have already submitted an application", status: existing.status });
        return;
      }

      const photoFile = req.file;
      if (!photoFile) {
        res.status(400).json({ error: "A passport/portrait photo is required" });
        return;
      }

      const email = req.userEmail!.toLowerCase();
      const otp = await verifyEmailOtp({
        email,
        purpose: "student_apply",
        code: parsed.data.otpCode,
      });
      if (!otp.ok) {
        res.status(400).json({ error: otp.error });
        return;
      }

      const stored = await compressAndStoreStudentPhoto(photoFile.path, uploadDir);
      const data = parsed.data;

      const profile = await prisma.studentProfile.create({
        data: {
          userId: req.userId!,
          fullName: data.fullName.trim(),
          phone: data.phone.trim(),
          photoUrl: stored.publicPath,
          parentPhone: data.parentPhone?.trim() || null,
          address: data.address?.trim() || null,
          programme: data.programme,
          classMode: data.classMode as "PHYSICAL" | "ONLINE",
        },
      });

      res.status(201).json({
        ok: true,
        status: profile.status,
        message: "Application submitted. Your account is pending admin review.",
      });
    } catch (err) {
      console.error("[student.apply]", err);
      res.status(500).json({ error: "Failed to submit application" });
    }
  },
);

studentsRouter.get("/student/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId! },
      select: {
        id: true, fullName: true, phone: true, photoUrl: true,
        parentPhone: true, address: true, programme: true,
        customMonths: true, classMode: true,
        status: true, rejectionNote: true, startDate: true,
        createdAt: true,
      },
    });

    res.json({ profile });
  } catch (err) {
    console.error("[student.me]", err);
    res.json({ profile: null });
  }
});

studentsRouter.get("/student/messages", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId! },
    });
    if (!profile) {
      res.json({ messages: [] });
      return;
    }

    const messages = await prisma.studentMessage.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    res.json({ messages });
  } catch (err) {
    console.error("[student.messages]", err);
    res.json({ messages: [] });
  }
});

studentsRouter.post("/student/messages", authLimiter, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId! },
    });
    if (!profile) {
      res.status(404).json({ error: "No profile found" });
      return;
    }

    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body || body.length > 500) {
      res.status(400).json({ error: "Message required (max 500 chars)" });
      return;
    }

    const msg = await prisma.studentMessage.create({
      data: { profileId: profile.id, fromAdmin: false, body },
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error("[student.messages.post]", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

studentsRouter.post("/student/attendance", authLimiter, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId! },
    });
    if (!profile || profile.status !== StudentStatus.APPROVED) {
      res.status(403).json({ error: "Only approved students can sign attendance" });
      return;
    }
    if (!profile.startDate) {
      res.status(400).json({ error: "Programme start date not set yet. Contact admin." });
      return;
    }

    const totalWeeks = programmeWeeks(profile.programme, profile.customMonths);
    const now = new Date();
    const startMs = profile.startDate.getTime();
    const elapsedMs = now.getTime() - startMs;
    const currentWeek = Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000)) + 1;

    if (currentWeek < 1) {
      res.status(400).json({ error: "Programme has not started yet" });
      return;
    }
    if (currentWeek > totalWeeks) {
      res.status(400).json({ error: "Programme has ended" });
      return;
    }

    const existing = await prisma.attendance.findUnique({
      where: { profileId_weekNumber: { profileId: profile.id, weekNumber: currentWeek } },
    });
    if (existing) {
      res.json({ ok: true, alreadySigned: true, weekNumber: currentWeek, signedAt: existing.signedAt });
      return;
    }

    const record = await prisma.attendance.create({
      data: {
        userId: req.userId!,
        profileId: profile.id,
        weekNumber: currentWeek,
      },
    });

    res.status(201).json({ ok: true, alreadySigned: false, weekNumber: currentWeek, signedAt: record.signedAt });
  } catch (err) {
    console.error("[student.attendance]", err);
    res.status(500).json({ error: "Failed to sign attendance" });
  }
});

studentsRouter.get("/student/attendance", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.userId! },
    });
    if (!profile) {
      res.json({ records: [], totalWeeks: 0, currentWeek: 0 });
      return;
    }

    const totalWeeks = programmeWeeks(profile.programme, profile.customMonths);
    let currentWeek = 0;
    if (profile.startDate) {
      const elapsedMs = Date.now() - profile.startDate.getTime();
      currentWeek = Math.max(1, Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000)) + 1);
    }

    const records = await prisma.attendance.findMany({
      where: { profileId: profile.id },
      orderBy: { weekNumber: "asc" },
      select: { weekNumber: true, signedAt: true },
    });

    res.json({ records, totalWeeks, currentWeek, startDate: profile.startDate });
  } catch (err) {
    console.error("[student.attendance.list]", err);
    res.json({ records: [], totalWeeks: 0, currentWeek: 0 });
  }
});

const CHAT_LIMIT = 10;
const CHAT_WINDOW_MS = 24 * 60 * 60 * 1000;

const chatSchema = z.object({ body: z.string().min(1).max(500) });

studentsRouter.post("/student/chat", authLimiter, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const isAdmin = req.userRole === "ADMIN" || req.userRole === "READONLY";
    if (!isAdmin) {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.userId! },
      });
      if (!profile || profile.status !== StudentStatus.APPROVED) {
        res.status(403).json({ error: "Only approved students can chat" });
        return;
      }
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Message body required (max 500 chars)" });
      return;
    }

    if (!isAdmin) {
      const windowStart = new Date(Date.now() - CHAT_WINDOW_MS);
      const recentCount = await prisma.chatMessage.count({
        where: { userId: req.userId!, createdAt: { gte: windowStart } },
      });

      if (recentCount >= CHAT_LIMIT) {
        res.status(429).json({
          error: `Message limit reached (${CHAT_LIMIT} per 24 hours). Try again later.`,
          remaining: 0,
        });
        return;
      }
    }

    const msg = await prisma.chatMessage.create({
      data: { userId: req.userId!, body: parsed.data.body.trim() },
      select: { id: true, body: true, createdAt: true },
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error("[student.chat.post]", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

studentsRouter.get("/student/chat", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const isAdmin = req.userRole === "ADMIN" || req.userRole === "READONLY";
    if (!isAdmin) {
      const profile = await prisma.studentProfile.findUnique({ where: { userId: req.userId! } });
      if (!profile || profile.status !== StudentStatus.APPROVED) {
        res.status(403).json({ error: "Only approved students can view chat" });
        return;
      }
    }

    const cursor = typeof req.query.before === "string" ? req.query.before : undefined;
    const messages = await prisma.chatMessage.findMany({
      where: cursor ? { createdAt: { lt: new Date(cursor) } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, body: true, createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    let remaining = CHAT_LIMIT;
    if (!isAdmin) {
      const windowStart = new Date(Date.now() - CHAT_WINDOW_MS);
      const myCount = await prisma.chatMessage.count({
        where: { userId: req.userId!, createdAt: { gte: windowStart } },
      });
      remaining = Math.max(0, CHAT_LIMIT - myCount);
    }

    res.json({ messages: messages.reverse(), remaining });
  } catch (err) {
    console.error("[student.chat.list]", err);
    res.json({ messages: [], remaining: 0 });
  }
});

studentsRouter.get("/ops/students", requireAdmin, async (_req, res) => {
  try {
    const students = await prisma.studentProfile.findMany({
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
        _count: { select: { attendance: true, messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json({
      items: students.map((s) => ({
        id: s.id,
        userId: s.userId,
        fullName: s.fullName,
        phone: s.phone,
        photoUrl: s.photoUrl,
        parentPhone: s.parentPhone,
        address: s.address,
        programme: s.programme,
        customMonths: s.customMonths,
        classMode: s.classMode,
        status: s.status,
        startDate: s.startDate,
        reviewedAt: s.reviewedAt,
        reviewedBy: s.reviewedBy,
        rejectionNote: s.rejectionNote,
        createdAt: s.createdAt,
        attendanceCount: s._count.attendance,
        messageCount: s._count.messages,
        user: s.user,
      })),
    });
  } catch (err) {
    console.error("[ops.students]", err);
    res.status(500).json({ error: "Failed to load students" });
  }
});

studentsRouter.post("/ops/students/:id/approve", authLimiter, requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const startDate = new Date();
    await prisma.studentProfile.update({
      where: { id },
      data: {
        status: StudentStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: req.userEmail,
        startDate,
        rejectionNote: null,
      },
    });

    await writeAudit({ adminEmail: req.userEmail!, action: "student.approve", targetId: id });

    res.json({ ok: true, status: "APPROVED", startDate });
  } catch (err) {
    console.error("[ops.students.approve]", err);
    res.status(500).json({ error: "Failed to approve student" });
  }
});

studentsRouter.post("/ops/students/:id/reject", authLimiter, requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    await prisma.studentProfile.update({
      where: { id },
      data: {
        status: StudentStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: req.userEmail,
        rejectionNote: note,
      },
    });

    await writeAudit({ adminEmail: req.userEmail!, action: "student.reject", targetId: id });

    res.json({ ok: true, status: "REJECTED" });
  } catch (err) {
    console.error("[ops.students.reject]", err);
    res.status(500).json({ error: "Failed to reject student" });
  }
});

studentsRouter.post("/ops/students/:id/reconsider", authLimiter, requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    await prisma.studentProfile.update({
      where: { id },
      data: {
        status: StudentStatus.PENDING,
        reviewedAt: null,
        reviewedBy: null,
        rejectionNote: null,
      },
    });

    await writeAudit({ adminEmail: req.userEmail!, action: "student.reconsider", targetId: id });

    res.json({ ok: true, status: "PENDING" });
  } catch (err) {
    console.error("[ops.students.reconsider]", err);
    res.status(500).json({ error: "Failed to reconsider student" });
  }
});

studentsRouter.post("/ops/students/:id/revoke", authLimiter, requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    await prisma.studentProfile.update({
      where: { id },
      data: {
        status: StudentStatus.PENDING,
        reviewedAt: new Date(),
        reviewedBy: req.userEmail,
        startDate: null,
      },
    });

    await writeAudit({ adminEmail: req.userEmail!, action: "student.revoke", targetId: id });

    res.json({ ok: true, status: "PENDING" });
  } catch (err) {
    console.error("[ops.students.revoke]", err);
    res.status(500).json({ error: "Failed to revoke student" });
  }
});

studentsRouter.post("/ops/students/:id/update-programme", authLimiter, requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const { programme, customMonths } = req.body ?? {};
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const validProgrammes = ["FIVE_MONTH", "SIX_MONTH", "CUSTOM"];
    if (!validProgrammes.includes(programme)) {
      res.status(400).json({ error: "Invalid programme type" });
      return;
    }

    const months = programme === "CUSTOM" ? Number(customMonths) || null : null;

    await prisma.studentProfile.update({
      where: { id },
      data: { programme, customMonths: months },
    });

    await writeAudit({
      adminEmail: req.userEmail!,
      action: "student.update_programme",
      targetId: id,
      metadata: { programme, customMonths: months },
    });

    res.json({ ok: true, programme, customMonths: months });
  } catch (err) {
    console.error("[ops.students.update-programme]", err);
    res.status(500).json({ error: "Failed to update programme" });
  }
});

studentsRouter.get("/ops/students/:id/messages", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const messages = await prisma.studentMessage.findMany({
      where: { profileId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ messages });
  } catch (err) {
    console.error("[ops.students.messages]", err);
    res.json({ messages: [] });
  }
});

studentsRouter.post("/ops/students/:id/messages", authLimiter, requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body || body.length > 500) {
      res.status(400).json({ error: "Message required (max 500 chars)" });
      return;
    }

    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const msg = await prisma.studentMessage.create({
      data: { profileId: id, fromAdmin: true, body },
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error("[ops.students.messages.post]", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

studentsRouter.get("/ops/students/:id/attendance", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      select: { id: true, fullName: true, programme: true, customMonths: true, startDate: true },
    });
    if (!profile) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const records = await prisma.attendance.findMany({
      where: { profileId: profile.id },
      orderBy: { weekNumber: "asc" },
      select: { weekNumber: true, signedAt: true },
    });

    const totalWeeks = programmeWeeks(profile.programme, profile.customMonths);
    res.json({ student: profile, records, totalWeeks });
  } catch (err) {
    console.error("[ops.students.attendance]", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

function programmeWeeks(programme: string, customMonths: number | null): number {
  if (programme === "CUSTOM" && customMonths) return customMonths * 4;
  return programme === "FIVE_MONTH" ? 22 : 26;
}
