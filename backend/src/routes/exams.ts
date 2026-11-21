import { Router } from "express";
import { z } from "zod";
import { ExamEventKind, ExamSessionStatus, ExaminationStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireAdmin, requireAdminWrite } from "../middleware/requireAuth.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { writeAudit } from "../lib/audit.js";
import { cacheDelPattern } from "../lib/cache.js";

export const examsRouter = Router();

const titleSchema = z.string().trim().min(2).max(120);
const promptSchema = z.string().trim().min(2).max(4000);
const answerSchema = z.string().max(4000);

const createExamSchema = z.object({
  title: titleSchema,
  instructions: z.string().trim().max(4000).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(10).max(180),
});

const questionSchema = z.object({
  prompt: promptSchema,
  marks: z.coerce.number().int().min(1).max(100),
  choices: z.array(z.string().trim().min(1).max(200)).max(6).optional(),
});

const answersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(40),
        response: answerSchema,
        choice: z.string().trim().max(200).optional().nullable(),
      }),
    )
    .max(40),
});

const eventSchema = z.object({
  kind: z.nativeEnum(ExamEventKind),
  still: z.string().max(700_000).optional().nullable(),
});

const gradeSchema = z.object({
  score: z.string().trim().min(1).max(40),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

const submitSchema = z.object({
  reason: z.enum(["STUDENT", "TAB_LEFT", "DEADLINE"]).optional(),
});

const accessSchema = z.object({
  studentProfileIds: z.array(z.string().trim().min(1).max(40)).max(200),
});

function maxMarks(questions: { marks: number }[]): number {
  return questions.reduce((sum, q) => sum + q.marks, 0);
}

async function closeIfExpired<T extends { id: string; status: ExamSessionStatus; deadlineAt: Date }>(
  session: T,
): Promise<T> {
  if (session.status === "IN_PROGRESS" && session.deadlineAt.getTime() <= Date.now()) {
    const updated = await prisma.examSession.update({
      where: { id: session.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    return { ...session, ...updated } as T;
  }
  return session;
}

async function approvedStudent(req: AuthedRequest) {
  if (!req.userId || req.userRole === "ADMIN" || req.userRole === "READONLY") return null;
  const profile = await prisma.studentProfile.findUnique({ where: { userId: req.userId } });
  if (!profile || profile.status !== "APPROVED" || !profile.registrationPaidAt) return null;
  return profile;
}

examsRouter.get("/student/exams", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await approvedStudent(req);
    if (!profile) {
      res.status(403).json({ error: "Approved students can open exams" });
      return;
    }
    const exams = await prisma.examination.findMany({
      where: {
        OR: [
          { status: "PUBLISHED", access: { some: { studentProfileId: profile.id } } },
          { sessions: { some: { studentProfileId: profile.id } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        questions: { select: { marks: true } },
        sessions: { where: { studentProfileId: profile.id } },
      },
    });
    const items = [];
    for (const exam of exams) {
      let session = exam.sessions[0] ?? null;
      if (session) session = await closeIfExpired(session);
      const visible = exam.status === "PUBLISHED" || session;
      if (!visible) continue;
      items.push({
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        session: session
          ? {
              id: session.id,
              status: session.status,
              deadlineAt: session.deadlineAt.toISOString(),
              submittedAt: session.submittedAt?.toISOString() ?? null,
              score: session.score,
              maxScore: session.maxScore,
              feedback: session.feedback,
            }
          : null,
      });
    }
    res.json({ exams: items });
  } catch (err) {
    console.error("[student.exams.list]", err);
    res.status(500).json({ error: "Failed to load exams" });
  }
});

examsRouter.post("/student/exams/:id/start", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await approvedStudent(req);
    if (!profile) {
      res.status(403).json({ error: "Approved students can open exams" });
      return;
    }
    const id = String(req.params.id);
    const exam = await prisma.examination.findUnique({
      where: { id },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!exam || exam.status !== "PUBLISHED") {
      res.status(404).json({ error: "This exam is not open" });
      return;
    }
    const allowed = await prisma.examAccess.findUnique({
      where: {
        examinationId_studentProfileId: { examinationId: id, studentProfileId: profile.id },
      },
      select: { id: true },
    });
    const existing = await prisma.examSession.findUnique({
      where: { examinationId_studentProfileId: { examinationId: id, studentProfileId: profile.id } },
    });
    if (!allowed && !existing) {
      res.status(403).json({ error: "This exam is not open to you" });
      return;
    }
    if (exam.questions.length === 0) {
      res.status(400).json({ error: "This exam has no questions yet" });
      return;
    }
    if (existing) {
      const session = await closeIfExpired(existing);
      res.status(200).json({ sessionId: session.id, status: session.status });
      return;
    }
    const deadline = new Date(Date.now() + exam.durationMinutes * 60_000);
    const session = await prisma.examSession.create({
      data: {
        examinationId: id,
        studentProfileId: profile.id,
        deadlineAt: deadline,
        maxScore: String(maxMarks(exam.questions)),
      },
    });
    res.status(201).json({ sessionId: session.id, status: session.status });
  } catch (err) {
    console.error("[student.exams.start]", err);
    res.status(500).json({ error: "Failed to start exam" });
  }
});

async function loadOwnedSession(req: AuthedRequest, sessionId: string) {
  const profile = await approvedStudent(req);
  if (!profile) return { ok: false as const, status: 403 as const, message: "Approved students can open exams" };
  const session = await prisma.examSession.findFirst({
    where: { id: sessionId, studentProfileId: profile.id },
    include: {
      examination: { include: { questions: { orderBy: { sortOrder: "asc" as const } } } },
      answers: true,
      events: { select: { kind: true } },
    },
  });
  if (!session) return { ok: false as const, status: 404 as const, message: "Exam not found" };
  return { ok: true as const, profile, session };
}

function studentView(session: {
  id: string;
  status: ExamSessionStatus;
  deadlineAt: Date;
  submittedAt: Date | null;
  score: string | null;
  maxScore: string | null;
  feedback: string | null;
  examination: {
    title: string;
    instructions: string | null;
    durationMinutes: number;
    status: ExaminationStatus;
    questions: { id: string; prompt: string; marks: number; sortOrder: number; choices: string[] }[];
  };
  answers: { questionId: string; response: string; choice: string | null }[];
  events: { kind: ExamEventKind }[];
}) {
  const open = session.status === "IN_PROGRESS";
  return {
    id: session.id,
    status: session.status,
    title: session.examination.title,
    instructions: session.examination.instructions,
    durationMinutes: session.examination.durationMinutes,
    deadlineAt: session.deadlineAt.toISOString(),
    submittedAt: session.submittedAt?.toISOString() ?? null,
    score: open ? null : session.score,
    maxScore: session.maxScore,
    feedback: open ? null : session.feedback,
    warningCount: session.events.length,
    questions: open
      ? session.examination.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          marks: q.marks,
          choices: q.choices,
          choice: session.answers.find((a) => a.questionId === q.id)?.choice ?? "",
          response: session.answers.find((a) => a.questionId === q.id)?.response ?? "",
        }))
      : [],
  };
}

examsRouter.get("/student/exams/sessions/:sessionId", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const loaded = await loadOwnedSession(req, String(req.params.sessionId));
    if (!loaded.ok) {
      res.status(loaded.status).json({ error: loaded.message });
      return;
    }
    const session = await closeIfExpired(loaded.session);
    const fresh = session.status === loaded.session.status ? loaded.session : { ...loaded.session, ...session };
    res.json({ session: studentView(fresh) });
  } catch (err) {
    console.error("[student.exams.session]", err);
    res.status(500).json({ error: "Failed to load exam" });
  }
});

examsRouter.put("/student/exams/sessions/:sessionId/answers", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = answersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Answers are too long" });
      return;
    }
    const loaded = await loadOwnedSession(req, String(req.params.sessionId));
    if (!loaded.ok) {
      res.status(loaded.status).json({ error: loaded.message });
      return;
    }
    const session = await closeIfExpired(loaded.session);
    if (session.status !== "IN_PROGRESS") {
      res.status(409).json({ error: "This paper is already handed in", status: session.status });
      return;
    }
    const allowed = new Set(loaded.session.examination.questions.map((q) => q.id));
    for (const answer of parsed.data.answers) {
      if (!allowed.has(answer.questionId)) continue;
      await prisma.examAnswer.upsert({
        where: { sessionId_questionId: { sessionId: session.id, questionId: answer.questionId } },
        create: {
          sessionId: session.id,
          questionId: answer.questionId,
          response: answer.response,
          choice: answer.choice?.trim() || null,
        },
        update: { response: answer.response, choice: answer.choice?.trim() || null },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[student.exams.answers]", err);
    res.status(500).json({ error: "Failed to save answers" });
  }
});

examsRouter.post("/student/exams/sessions/:sessionId/events", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Unknown warning" });
      return;
    }
    const loaded = await loadOwnedSession(req, String(req.params.sessionId));
    if (!loaded.ok) {
      res.status(loaded.status).json({ error: loaded.message });
      return;
    }
    const session = await closeIfExpired(loaded.session);
    if (session.status !== "IN_PROGRESS") {
      res.json({ ok: true, ignored: true });
      return;
    }
    const count = await prisma.examEvent.count({ where: { sessionId: session.id } });
    if (count >= 60) {
      res.json({ ok: true, ignored: true });
      return;
    }
    const recent = await prisma.examEvent.findFirst({
      where: {
        sessionId: session.id,
        kind: parsed.data.kind,
        createdAt: { gt: new Date(Date.now() - 20_000) },
      },
    });
    if (!recent) {
      const still =
        parsed.data.kind === "SECOND_FACE" && parsed.data.still?.startsWith("data:image/")
          ? parsed.data.still
          : null;
      await prisma.examEvent.create({
        data: { sessionId: session.id, kind: parsed.data.kind, still },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[student.exams.events]", err);
    res.status(500).json({ error: "Failed to record warning" });
  }
});

examsRouter.post("/student/exams/sessions/:sessionId/submit", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = submitSchema.safeParse(req.body ?? {});
    const reason = parsed.success ? parsed.data.reason : "STUDENT";
    const loaded = await loadOwnedSession(req, String(req.params.sessionId));
    if (!loaded.ok) {
      res.status(loaded.status).json({ error: loaded.message });
      return;
    }
    if (loaded.session.status === "IN_PROGRESS") {
      await prisma.examSession.update({
        where: { id: loaded.session.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      if (reason === "TAB_LEFT") {
        const count = await prisma.examEvent.count({ where: { sessionId: loaded.session.id } });
        if (count < 60) {
          await prisma.examEvent.create({
            data: { sessionId: loaded.session.id, kind: "TAB_LEFT" },
          });
        }
      }
    }
    res.json({ ok: true, status: "SUBMITTED" });
  } catch (err) {
    console.error("[student.exams.submit]", err);
    res.status(500).json({ error: "Failed to submit exam" });
  }
});

examsRouter.get("/ops/examinations", requireAdmin, async (_req, res) => {
  try {
    const exams = await prisma.examination.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        questions: { select: { id: true, marks: true } },
        _count: { select: { sessions: true } },
      },
    });
    res.json({
      exams: exams.map((exam) => ({
        id: exam.id,
        title: exam.title,
        instructions: exam.instructions,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        questionCount: exam.questions.length,
        maxScore: String(maxMarks(exam.questions)),
        submissions: exam._count.sessions,
        createdAt: exam.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[ops.examinations.list]", err);
    res.status(500).json({ error: "Failed to load exams" });
  }
});

examsRouter.post("/ops/examinations", requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const parsed = createExamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Name the exam and set a time between 10 and 180 minutes" });
      return;
    }
    const exam = await prisma.examination.create({
      data: {
        title: parsed.data.title,
        instructions: parsed.data.instructions?.trim() || null,
        durationMinutes: parsed.data.durationMinutes,
        createdBy: req.userEmail ?? null,
      },
    });
    await writeAudit({
      adminEmail: req.userEmail || "admin",
      action: "exam.create",
      targetId: exam.id,
      metadata: { title: exam.title },
    });
    res.status(201).json({ id: exam.id });
  } catch (err) {
    console.error("[ops.examinations.create]", err);
    res.status(500).json({ error: "Failed to create exam" });
  }
});

examsRouter.get("/ops/examinations/:id", requireAdmin, async (req, res) => {
  try {
    const exam = await prisma.examination.findUnique({
      where: { id: String(req.params.id) },
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        access: {
          include: { profile: { select: { id: true, fullName: true, user: { select: { email: true } } } } },
        },
        sessions: {
          orderBy: { startedAt: "desc" },
          include: {
            profile: { select: { id: true, fullName: true } },
            events: { select: { kind: true } },
          },
        },
      },
    });
    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    res.json({
      exam: {
        id: exam.id,
        title: exam.title,
        instructions: exam.instructions,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        maxScore: String(maxMarks(exam.questions)),
        questions: exam.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          marks: q.marks,
          choices: q.choices,
          sortOrder: q.sortOrder,
        })),
        access: exam.access.map((row) => ({
          id: row.profile.id,
          fullName: row.profile.fullName,
          email: row.profile.user.email,
        })),
        sessions: exam.sessions.map((s) => ({
          id: s.id,
          status: s.status,
          studentName: s.profile.fullName,
          studentId: s.profile.id,
          startedAt: s.startedAt.toISOString(),
          submittedAt: s.submittedAt?.toISOString() ?? null,
          score: s.score,
          maxScore: s.maxScore,
          warnings: s.events.reduce<Record<string, number>>((acc, event) => {
            acc[event.kind] = (acc[event.kind] ?? 0) + 1;
            return acc;
          }, {}),
        })),
      },
    });
  } catch (err) {
    console.error("[ops.examinations.get]", err);
    res.status(500).json({ error: "Failed to load exam" });
  }
});

examsRouter.put("/ops/examinations/:id/access", requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const parsed = accessSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose the students who can open this exam" });
      return;
    }
    const id = String(req.params.id);
    const exam = await prisma.examination.findUnique({ where: { id }, select: { id: true } });
    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    const ids = [...new Set(parsed.data.studentProfileIds)];
    const profiles = await prisma.studentProfile.findMany({
      where: { id: { in: ids }, status: "APPROVED" },
      select: { id: true },
    });
    const allowed = new Set(profiles.map((row) => row.id));
    const keep = ids.filter((studentId) => allowed.has(studentId));
    await prisma.$transaction([
      prisma.examAccess.deleteMany({
        where: { examinationId: id, studentProfileId: { notIn: keep.length ? keep : ["__none__"] } },
      }),
      ...keep.map((studentProfileId) =>
        prisma.examAccess.upsert({
          where: {
            examinationId_studentProfileId: { examinationId: id, studentProfileId },
          },
          create: { examinationId: id, studentProfileId },
          update: {},
        }),
      ),
    ]);
    await writeAudit({
      adminEmail: req.userEmail || "admin",
      action: "exam.access",
      targetId: id,
      metadata: { count: keep.length },
    });
    res.json({ ok: true, count: keep.length });
  } catch (err) {
    console.error("[ops.examinations.access]", err);
    res.status(500).json({ error: "Failed to save exam access" });
  }
});

examsRouter.patch("/ops/examinations/:id", requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const parsed = createExamSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Check the exam name and time" });
      return;
    }
    const id = String(req.params.id);
    const existing = await prisma.examination.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    const nextMinutes = parsed.data.durationMinutes;
    await prisma.examination.update({
      where: { id },
      data: {
        title: parsed.data.title,
        instructions:
          parsed.data.instructions === undefined ? undefined : parsed.data.instructions?.trim() || null,
        durationMinutes: nextMinutes,
      },
    });
    if (nextMinutes) {
      const live = await prisma.examSession.findMany({
        where: { examinationId: id, status: "IN_PROGRESS" },
        select: { id: true, startedAt: true },
      });
      for (const row of live) {
        await prisma.examSession.update({
          where: { id: row.id },
          data: { deadlineAt: new Date(row.startedAt.getTime() + nextMinutes * 60_000) },
        });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[ops.examinations.patch]", err);
    res.status(500).json({ error: "Failed to update exam" });
  }
});

examsRouter.post("/ops/examinations/:id/publish", requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const exam = await prisma.examination.findUnique({
      where: { id },
      include: { questions: { select: { id: true } } },
    });
    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    if (exam.questions.length === 0) {
      res.status(400).json({ error: "Add at least one question before publishing" });
      return;
    }
    const accessCount = await prisma.examAccess.count({ where: { examinationId: id } });
    if (accessCount === 0) {
      res.status(400).json({ error: "Choose at least one student before publishing" });
      return;
    }
    await prisma.examination.update({ where: { id }, data: { status: "PUBLISHED" } });
    await writeAudit({ adminEmail: req.userEmail || "admin", action: "exam.publish", targetId: id });
    res.json({ ok: true });
  } catch (err) {
    console.error("[ops.examinations.publish]", err);
    res.status(500).json({ error: "Failed to publish exam" });
  }
});

examsRouter.post("/ops/examinations/:id/delete", requireAdminWrite, async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.examination.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    await prisma.examination.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("[ops.examinations.delete]", err);
    res.status(500).json({ error: "Failed to delete exam" });
  }
});

examsRouter.post("/ops/examinations/:id/close", requireAdminWrite, async (req, res) => {
  try {
    const id = String(req.params.id);
    const exam = await prisma.examination.findUnique({ where: { id } });
    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    await prisma.examination.update({ where: { id }, data: { status: "CLOSED" } });
    res.json({ ok: true });
  } catch (err) {
    console.error("[ops.examinations.close]", err);
    res.status(500).json({ error: "Failed to close exam" });
  }
});

examsRouter.post("/ops/examinations/:id/questions", requireAdminWrite, async (req, res) => {
  try {
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Write the question and the points" });
      return;
    }
    const id = String(req.params.id);
    const exam = await prisma.examination.findUnique({
      where: { id },
      include: { _count: { select: { questions: true, sessions: true } } },
    });
    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    if (exam._count.questions >= 40) {
      res.status(400).json({ error: "This paper already has 40 questions" });
      return;
    }
    const question = await prisma.examQuestion.create({
      data: {
        examinationId: id,
        prompt: parsed.data.prompt,
        marks: parsed.data.marks,
        choices: parsed.data.choices ?? [],
        sortOrder: exam._count.questions,
      },
    });
    res.status(201).json({ id: question.id });
  } catch (err) {
    console.error("[ops.examinations.question]", err);
    res.status(500).json({ error: "Failed to add question" });
  }
});

examsRouter.patch("/ops/examinations/:id/questions/:questionId", requireAdminWrite, async (req, res) => {
  try {
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Write the question and the points" });
      return;
    }
    const id = String(req.params.id);
    const questionId = String(req.params.questionId);
    const existing = await prisma.examQuestion.findFirst({
      where: { id: questionId, examinationId: id },
    });
    if (!existing) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    await prisma.examQuestion.update({
      where: { id: questionId },
      data: {
        prompt: parsed.data.prompt,
        marks: parsed.data.marks,
        choices: parsed.data.choices ?? [],
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[ops.examinations.question.patch]", err);
    res.status(500).json({ error: "Failed to update question" });
  }
});

examsRouter.post("/ops/examinations/:id/questions/:questionId/delete", requireAdminWrite, async (req, res) => {
  try {
    const id = String(req.params.id);
    const questionId = String(req.params.questionId);
    await prisma.examQuestion.deleteMany({ where: { id: questionId, examinationId: id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("[ops.examinations.question.delete]", err);
    res.status(500).json({ error: "Failed to remove question" });
  }
});

examsRouter.get("/ops/examinations/:id/sessions/:sessionId", requireAdmin, async (req, res) => {
  try {
    const session = await prisma.examSession.findFirst({
      where: { id: String(req.params.sessionId), examinationId: String(req.params.id) },
      include: {
        profile: { select: { id: true, fullName: true } },
        answers: true,
        events: { orderBy: { createdAt: "asc" } },
        examination: { include: { questions: { orderBy: { sortOrder: "asc" } } } },
      },
    });
    if (!session) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    res.json({
      session: {
        id: session.id,
        status: session.status,
        title: session.examination.title,
        studentName: session.profile.fullName,
        studentId: session.profile.id,
        startedAt: session.startedAt.toISOString(),
        submittedAt: session.submittedAt?.toISOString() ?? null,
        score: session.score,
        maxScore: session.maxScore ?? String(maxMarks(session.examination.questions)),
        feedback: session.feedback,
        events: session.events.map((event) => ({
          kind: event.kind,
          still: event.still,
          createdAt: event.createdAt.toISOString(),
        })),
        questions: session.examination.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          marks: q.marks,
          choices: q.choices,
          choice: session.answers.find((a) => a.questionId === q.id)?.choice ?? "",
          response: session.answers.find((a) => a.questionId === q.id)?.response ?? "",
        })),
      },
    });
  } catch (err) {
    console.error("[ops.examinations.session]", err);
    res.status(500).json({ error: "Failed to load submission" });
  }
});

examsRouter.post("/ops/examinations/:id/sessions/:sessionId/grade", requireAdminWrite, async (req: AuthedRequest, res) => {
  try {
    const parsed = gradeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter the mark" });
      return;
    }
    const session = await prisma.examSession.findFirst({
      where: { id: String(req.params.sessionId), examinationId: String(req.params.id) },
      include: {
        examination: { include: { questions: { select: { marks: true } } } },
      },
    });
    if (!session) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (session.status === "IN_PROGRESS") {
      res.status(409).json({ error: "The student has not submitted yet" });
      return;
    }
    const maxScore = session.maxScore || String(maxMarks(session.examination.questions));
    const feedback = parsed.data.feedback?.trim() || null;
    await prisma.$transaction(async (tx) => {
      let assessmentId = session.assessmentId;
      if (assessmentId) {
        const existing = await tx.studentAssessment.findUnique({ where: { id: assessmentId } });
        if (!existing) assessmentId = null;
      }
      if (assessmentId) {
        await tx.studentAssessment.update({
          where: { id: assessmentId },
          data: {
            title: session.examination.title,
            score: parsed.data.score,
            maxScore,
            notes: feedback,
            takenAt: session.submittedAt ?? session.startedAt,
          },
        });
      } else {
        const count = await tx.studentAssessment.count({
          where: { studentProfileId: session.studentProfileId, kind: "EXAMINATION" },
        });
        const assessment = await tx.studentAssessment.create({
          data: {
            studentProfileId: session.studentProfileId,
            kind: "EXAMINATION",
            title: session.examination.title,
            score: parsed.data.score,
            maxScore,
            notes: feedback,
            takenAt: session.submittedAt ?? session.startedAt,
            sortOrder: count,
          },
        });
        assessmentId = assessment.id;
      }
      await tx.examSession.update({
        where: { id: session.id },
        data: {
          status: "GRADED",
          score: parsed.data.score,
          maxScore,
          feedback,
          gradedAt: new Date(),
          gradedBy: req.userEmail ?? null,
          assessmentId,
        },
      });
    });
    cacheDelPattern("cert:");
    await writeAudit({
      adminEmail: req.userEmail || "admin",
      action: "exam.grade",
      targetId: session.id,
      metadata: { score: parsed.data.score },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[ops.examinations.grade]", err);
    res.status(500).json({ error: "Failed to save the mark" });
  }
});
