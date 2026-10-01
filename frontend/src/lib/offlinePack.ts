import { apiGet, apiPost } from "./api";
import type { NewsItem } from "./newsInterest";

export const PACK_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const QUIZ_PACK = 50;
export const QUIZ_PLAY = 10;

const QUIZ_KEY = "d26_quiz_pack";
const NEWS_KEY = "d26_news_pack";

export type CachedQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
};

export type QuizResult = {
  score: number;
  total: number;
  breakdown: Array<{ id: string; correct: boolean; answerIndex: number; yourIndex: number | null }>;
};

type QuizStore = {
  savedAt: number;
  questions: CachedQuestion[];
  usedIds: string[];
};

type NewsStore = {
  savedAt: number;
  items: NewsItem[];
};

function now() {
  return Date.now();
}

function fresh(savedAt: number): boolean {
  return now() - savedAt < PACK_TTL_MS;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function asQuestion(row: unknown): CachedQuestion | null {
  if (!row || typeof row !== "object") return null;
  const q = row as Partial<CachedQuestion>;
  if (typeof q.id !== "string" || typeof q.prompt !== "string") return null;
  if (!Array.isArray(q.choices) || typeof q.answerIndex !== "number") return null;
  if (q.answerIndex < 0 || q.answerIndex >= q.choices.length) return null;
  return {
    id: q.id,
    prompt: q.prompt,
    choices: q.choices.map((c) => String(c)),
    answerIndex: q.answerIndex,
  };
}

function mergeQuestions(base: CachedQuestion[], extra: CachedQuestion[]): CachedQuestion[] {
  const seen = new Set(base.map((q) => q.id));
  const out = [...base];
  for (const q of extra) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}

export function loadQuizStore(): QuizStore {
  const stored = readJson<QuizStore>(QUIZ_KEY);
  if (!stored || !fresh(stored.savedAt) || !Array.isArray(stored.questions)) {
    return { savedAt: 0, questions: [], usedIds: [] };
  }
  return {
    savedAt: stored.savedAt,
    questions: stored.questions.map(asQuestion).filter((q): q is CachedQuestion => Boolean(q)),
    usedIds: Array.isArray(stored.usedIds) ? stored.usedIds.filter((id) => typeof id === "string") : [],
  };
}

export function saveQuizStore(store: QuizStore) {
  writeJson(QUIZ_KEY, store);
}

export function loadNewsStore(): NewsItem[] {
  const stored = readJson<NewsStore>(NEWS_KEY);
  if (!stored || !fresh(stored.savedAt) || !Array.isArray(stored.items)) return [];
  return stored.items.filter((item) => item && typeof item.id === "string" && typeof item.title === "string");
}

export function saveNewsStore(items: NewsItem[]) {
  writeJson(NEWS_KEY, { savedAt: now(), items } satisfies NewsStore);
}

export function unusedQuestions(store = loadQuizStore()): CachedQuestion[] {
  const used = new Set(store.usedIds);
  return store.questions.filter((q) => !used.has(q.id));
}

export function markQuizUsed(ids: string[]) {
  const store = loadQuizStore();
  const used = new Set(store.usedIds);
  for (const id of ids) used.add(id);
  store.usedIds = [...used];
  saveQuizStore(store);
  return store;
}

export function scoreQuiz(picks: Record<string, number>, questions: CachedQuestion[]): QuizResult {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ids = Object.keys(picks).filter((id) => byId.has(id));
  let score = 0;
  const breakdown = ids.map((id) => {
    const q = byId.get(id)!;
    const yourIndex = picks[id] ?? null;
    const correct = yourIndex === q.answerIndex;
    if (correct) score += 1;
    return { id, correct, answerIndex: q.answerIndex, yourIndex };
  });
  return { score, total: ids.length, breakdown };
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pickPlay(pool: CachedQuestion[], n = QUIZ_PLAY): CachedQuestion[] {
  return shuffle(pool).slice(0, Math.min(n, pool.length));
}

type QuizPackPayload = {
  ready?: boolean;
  questions?: unknown[];
};

type NewsPackPayload = {
  items?: NewsItem[];
};

export async function fetchQuizPack(exclude: string[] = []): Promise<CachedQuestion[]> {
  const qs = new URLSearchParams({ count: String(QUIZ_PACK) });
  if (exclude.length) qs.set("exclude", exclude.slice(0, 200).join(","));
  const data = await apiGet<QuizPackPayload>(`/api/public/quiz/pack?${qs.toString()}`);
  return (data.questions ?? []).map(asQuestion).filter((q): q is CachedQuestion => Boolean(q));
}

export async function fetchNewsPack(): Promise<NewsItem[]> {
  try {
    const data = await apiGet<NewsPackPayload>("/api/public/news/pack");
    if (data.items?.length) return data.items;
  } catch {
    /* fall back */
  }
  const today = await apiGet<NewsPackPayload>("/api/public/news/today");
  return today.items ?? [];
}

export async function refreshQuizPack(forceMore = false): Promise<QuizStore> {
  const store = loadQuizStore();
  const unused = unusedQuestions(store);
  const needMore = forceMore || unused.length < QUIZ_PLAY || store.questions.length < QUIZ_PACK;
  if (!needMore && fresh(store.savedAt)) return store;

  const incoming = await fetchQuizPack(store.questions.map((q) => q.id));
  const questions = mergeQuestions(store.questions, incoming);
  const next: QuizStore = {
    savedAt: now(),
    questions,
    usedIds: store.usedIds.filter((id) => questions.some((q) => q.id === id)),
  };
  saveQuizStore(next);
  return next;
}

export async function warmOfflinePacks() {
  try {
    const news = await fetchNewsPack();
    if (news.length) saveNewsStore(news);
  } catch {
    /* offline */
  }
  try {
    await refreshQuizPack(false);
  } catch {
    /* offline */
  }
}

export function reportQuizAttempt(answers: Record<string, number>) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  void apiPost("/api/public/quiz/today/submit", {
    visitorKey: visitorKey(),
    answers,
  }).catch(() => undefined);
}

function visitorKey(): string {
  try {
    const existing = sessionStorage.getItem("d26_quiz_visitor");
    if (existing && existing.length >= 8) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem("d26_quiz_visitor", next);
    return next;
  } catch {
    return `anon-${Date.now()}`;
  }
}
