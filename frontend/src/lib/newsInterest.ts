const KEY = "d26_news_interest";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "from",
  "by",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "as",
  "that",
  "this",
  "it",
  "its",
  "new",
  "says",
  "after",
  "over",
  "into",
  "about",
  "how",
  "why",
  "what",
  "when",
  "who",
  "will",
  "can",
  "has",
  "have",
  "not",
  "but",
  "you",
  "your",
  "our",
  "their",
]);

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string | null;
};

export type NewsInterest = {
  words: string[];
  lastTitle: string;
  lastId: string;
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function loadInterest(): NewsInterest | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsInterest;
    if (!parsed?.lastId || !Array.isArray(parsed.words)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function rememberStory(item: NewsItem): void {
  const words = tokenize(`${item.title} ${item.summary}`).slice(0, 28);
  const next: NewsInterest = { words, lastTitle: item.title, lastId: item.id };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function matchScore(item: NewsItem, words: string[]): number {
  if (!words.length) return 0;
  const bag = new Set(tokenize(`${item.title} ${item.summary}`));
  let n = 0;
  for (const w of words) if (bag.has(w)) n += 1;
  return n;
}

export function rankRelated(items: NewsItem[], interest: NewsInterest | null, excludeId?: string): NewsItem[] {
  const rest = items.filter((item) => item.id !== excludeId && item.id !== interest?.lastId);
  if (!interest?.words.length) return rest;
  return [...rest].sort((a, b) => {
    const diff = matchScore(b, interest.words) - matchScore(a, interest.words);
    if (diff !== 0) return diff;
    return (b.publishedAt || "").localeCompare(a.publishedAt || "");
  });
}

export function formatNewsTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
