import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { extractJson, groqChat } from "./groq.js";

export const QUIZ_PLAY = 10;
export const QUIZ_POOL = 30;

export type StoredQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
};

export type PublicQuestion = {
  id: string;
  prompt: string;
  choices: string[];
};

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function quizDateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function promptKey(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseQuestions(raw: unknown, max = 25): StoredQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredQuestion[] = [];
  for (const item of raw.slice(0, max)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    const choices = Array.isArray(row.choices)
      ? row.choices.map((c) => String(c).trim()).filter(Boolean)
      : [];
    const answerIndex = Number(row.answerIndex);
    if (!prompt || choices.length < 3 || choices.length > 6) continue;
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) {
      continue;
    }
    out.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : randomBytes(4).toString("hex"),
      prompt: prompt.slice(0, 280),
      choices: choices.map((c) => c.slice(0, 160)),
      answerIndex,
    });
  }
  return out;
}

function mergeQuestions(...groups: StoredQuestion[][]): StoredQuestion[] {
  const out: StoredQuestion[] = [];
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  for (const group of groups) {
    for (const q of group) {
      const key = promptKey(q.prompt);
      if (!key || seen.has(key) || seenIds.has(q.id)) continue;
      seen.add(key);
      seenIds.add(q.id);
      out.push(q);
      if (out.length >= QUIZ_POOL) return out;
    }
  }
  return out;
}

function quizBatchPrompt(dateKey: string, batch: string, count: number): { system: string; user: string } {
  return {
    system: "You write a tech quiz for The Digital 26 vibe-coding studio. Return JSON only. No markdown.",
    user: `Create ${count} unique multiple-choice questions about ${batch}. Date: ${dateKey}.
Return: {"questions":[{"id":"q1","prompt":"...","choices":["A","B","C","D"],"answerIndex":0}]}
Rules: 4 choices each, one correct answerIndex 0-3, no trick questions, English, beginner-to-intermediate.`,
  };
}

async function generateBatch(dateKey: string, batch: string, count: number): Promise<StoredQuestion[]> {
  const model = env.OPENAI_MODEL?.trim() || "openai/gpt-oss-20b";
  const prompt = quizBatchPrompt(dateKey, batch, count);
  try {
    const content = await groqChat({
      model,
      jsonMode: true,
      timeoutMs: 22_000,
      retries: 1,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    });
    if (!content) return [];
    const parsed = extractJson(content) as { questions?: unknown };
    return parseQuestions(parsed.questions, count);
  } catch (err) {
    console.warn("[quiz.ai.fail]", err);
    return [];
  }
}

export function toPublicQuestions(questions: StoredQuestion[]): PublicQuestion[] {
  return questions.map(({ id, prompt, choices }) => ({ id, prompt, choices }));
}

export function asStoredQuestions(raw: unknown): StoredQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is StoredQuestion => {
    if (!row || typeof row !== "object") return false;
    const q = row as StoredQuestion;
    return (
      typeof q.id === "string" &&
      typeof q.prompt === "string" &&
      Array.isArray(q.choices) &&
      typeof q.answerIndex === "number"
    );
  });
}

function isBankId(id: string): boolean {
  return /(?:^|-)b\d+$/.test(id);
}

async function persistPool(
  dateKey: string,
  existingId: string | null,
  questions: StoredQuestion[],
  source: string,
) {
  const quizDate = quizDateFromKey(dateKey);
  const title = `Daily tech quiz · ${dateKey}`;
  const data = {
    title,
    source,
    questions: questions as unknown as Prisma.InputJsonValue,
  };
  if (existingId) {
    return prisma.dailyQuiz.update({ where: { id: existingId }, data });
  }
  try {
    return await prisma.dailyQuiz.create({
      data: { quizDate, ...data },
    });
  } catch (err) {
    const raced = await prisma.dailyQuiz.findUnique({ where: { quizDate } });
    if (raced) return raced;
    throw err;
  }
}

export async function peekDailyQuiz(dateKey = utcDateKey()) {
  const quizDate = quizDateFromKey(dateKey);
  const existing = await prisma.dailyQuiz.findUnique({ where: { quizDate } });
  const kept = existing
    ? asStoredQuestions(existing.questions).filter((q) => !isBankId(q.id))
    : [];
  return { existing, kept };
}

export async function ensureDailyQuiz(dateKey = utcDateKey()) {
  const quizDate = quizDateFromKey(dateKey);
  const existing = await prisma.dailyQuiz.findUnique({ where: { quizDate } });
  let pool = existing
    ? asStoredQuestions(existing.questions).filter((q) => !isBankId(q.id))
    : [];
  let currentId = existing?.id ?? null;

  if (pool.length >= QUIZ_POOL && existing) {
    if (pool.length !== asStoredQuestions(existing.questions).length) {
      return persistPool(dateKey, existing.id, pool.slice(0, QUIZ_POOL), "ai");
    }
    return existing;
  }

  const hasAi = Boolean(
    env.GROQ_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || env.GEMINI_API_KEY?.trim(),
  );
  if (hasAi && pool.length < QUIZ_POOL) {
    const topic =
      pool.length < 15
        ? "HTML, CSS, JavaScript, the DOM, React, and Vite"
        : "Git, GitHub, HTTP, REST APIs, JSON, auth, SQL, security, prompting, and deploy";
    const part = await generateBatch(dateKey, topic, Math.min(15, QUIZ_POOL - pool.length + 2));
    pool = mergeQuestions(pool, part);
  }

  if (pool.length === 0) {
    throw new Error("AI quiz pool is not ready");
  }
  return persistPool(dateKey, currentId, pool.slice(0, QUIZ_POOL), "ai");
}

export function todayKey(): string {
  return utcDateKey();
}
