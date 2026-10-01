import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { publicLookupLimiter } from "../middleware/security.js";
import {
  asStoredQuestions,
  ensureDailyQuiz,
  peekDailyQuiz,
  QUIZ_PLAY,
  todayKey,
  toPublicQuestions,
} from "../lib/dailyQuiz.js";
import { ensureDailyNews, peekDailyNews } from "../lib/techNews.js";

function cronSecretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export const quizRouter = Router();

const submitSchema = z.object({
  visitorKey: z.string().trim().min(8).max(80),
  answers: z.record(z.string(), z.number().int().min(0).max(8)),
});

quizRouter.get("/public/quiz/today", publicLookupLimiter, async (_req, res) => {
  try {
    const { existing, kept } = await peekDailyQuiz();
    if (kept.length >= QUIZ_PLAY && existing) {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        ready: true,
        quizDate: todayKey(),
        playSize: QUIZ_PLAY,
        poolSize: kept.length,
        questions: toPublicQuestions(kept),
      });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ ready: false, quizDate: todayKey(), playSize: QUIZ_PLAY, poolSize: kept.length, questions: [] });
  } catch (err) {
    console.error("[quiz.today]", err);
    res.status(500).json({ error: "Quiz is not ready yet" });
  }
});

quizRouter.get("/public/news/today", publicLookupLimiter, async (_req, res) => {
  try {
    const items = await peekDailyNews();
    res.setHeader("Cache-Control", items.length ? "public, max-age=60" : "no-store");
    res.json({
      ready: items.length > 0,
      newsDate: todayKey(),
      items,
    });
  } catch (err) {
    console.error("[news.today]", err);
    res.status(500).json({ error: "News is not ready yet" });
  }
});

quizRouter.post("/public/quiz/today/submit", publicLookupLimiter, async (req, res) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Send visitorKey and answers" });
      return;
    }

    const { existing, kept } = await peekDailyQuiz();
    if (!existing || kept.length < QUIZ_PLAY) {
      res.status(503).json({ error: "Quiz is not ready yet" });
      return;
    }
    const quiz = existing;
    const questions = kept;

    const byId = new Map(questions.map((q) => [q.id, q]));
    const pickedIds = Object.keys(parsed.data.answers).filter((id) => byId.has(id));
    if (pickedIds.length !== QUIZ_PLAY) {
      res.status(400).json({ error: `Answer ${QUIZ_PLAY} questions` });
      return;
    }

    let score = 0;
    const breakdown = pickedIds.map((id) => {
      const q = byId.get(id)!;
      const picked = parsed.data.answers[id];
      const correct = picked === q.answerIndex;
      if (correct) score += 1;
      return {
        id: q.id,
        correct,
        answerIndex: q.answerIndex,
        yourIndex: typeof picked === "number" ? picked : null,
      };
    });

    await prisma.dailyQuizAttempt.create({
      data: {
        quizId: quiz.id,
        visitorKey: parsed.data.visitorKey.slice(0, 80),
        answers: parsed.data.answers,
        score,
        total: QUIZ_PLAY,
      },
    });

    res.json({
      quizDate: todayKey(),
      score,
      total: QUIZ_PLAY,
      breakdown,
    });
  } catch (err) {
    console.error("[quiz.submit]", err);
    res.status(500).json({ error: "Could not score quiz" });
  }
});

quizRouter.post("/cron/daily-quiz", async (req, res) => {
  const expected = env.CRON_SECRET?.trim();
  const got =
    (typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "") ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : "");
  if (!expected || !cronSecretsEqual(got, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  let poolSize = 0;
  let newsCount = 0;
  let quizId: string | undefined;
  let quizError: string | undefined;
  let newsError: string | undefined;

  try {
    const quiz = await ensureDailyQuiz();
    poolSize = asStoredQuestions(quiz.questions).length;
    quizId = quiz.id;
  } catch (err) {
    quizError = err instanceof Error ? err.message : "quiz failed";
    console.error("[quiz.cron]", err);
  }

  try {
    const news = await ensureDailyNews();
    newsCount = news.length;
  } catch (err) {
    newsError = err instanceof Error ? err.message : "news failed";
    console.error("[news.cron]", err);
  }

  const crashed = Boolean(quizError && newsError && poolSize === 0 && newsCount === 0);
  res.status(crashed ? 500 : 200).json({
    ok: poolSize >= QUIZ_PLAY && newsCount > 0,
    quizDate: todayKey(),
    poolSize,
    newsCount,
    id: quizId,
    quizError,
    newsError,
  });
});
