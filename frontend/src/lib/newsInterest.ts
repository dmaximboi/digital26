const KEY = "d26_news_interest";
const MAX_READS = 16;
const MAX_WORDS = 48;

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

type Read = {
  id: string;
  title: string;
  source: string;
  words: string[];
  at: number;
};

export type NewsInterest = {
  words: string[];
  sources: string[];
  lastTitle: string;
  lastId: string;
  reads: Read[];
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
    if (!parsed?.lastId) return null;
    return {
      words: Array.isArray(parsed.words) ? parsed.words : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      lastTitle: parsed.lastTitle || "",
      lastId: parsed.lastId,
      reads: Array.isArray(parsed.reads) ? parsed.reads : [],
    };
  } catch {
    return null;
  }
}

function rebuild(reads: Read[]): NewsInterest {
  const weight = new Map<string, number>();
  const sources: string[] = [];
  reads.forEach((read, index) => {
    const recency = (index + 1) / reads.length;
    for (const word of read.words) {
      weight.set(word, (weight.get(word) || 0) + recency);
    }
    if (read.source && !sources.includes(read.source)) sources.push(read.source);
  });
  const words = [...weight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_WORDS)
    .map(([word]) => word);
  const last = reads[reads.length - 1]!;
  return {
    words,
    sources,
    lastTitle: last.title,
    lastId: last.id,
    reads,
  };
}

export function rememberStory(item: NewsItem): NewsInterest {
  const prev = loadInterest();
  const words = tokenize(`${item.title} ${item.summary}`).slice(0, 28);
  const nextRead: Read = {
    id: item.id,
    title: item.title,
    source: item.source,
    words,
    at: Date.now(),
  };
  const reads = [...(prev?.reads ?? []).filter((row) => row.id !== item.id), nextRead].slice(-MAX_READS);
  const next = rebuild(reads);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function matchScore(item: NewsItem, interest: NewsInterest): number {
  const bag = tokenize(`${item.title} ${item.summary}`);
  const bagSet = new Set(bag);
  let score = 0;
  for (const word of interest.words) {
    if (bagSet.has(word)) score += 2;
  }
  if (item.source && interest.sources.includes(item.source)) score += 3;
  const last = interest.reads[interest.reads.length - 1];
  if (last?.source && item.source === last.source) score += 2;
  return score;
}

export function rankRelated(items: NewsItem[], interest: NewsInterest | null, excludeId?: string): NewsItem[] {
  if (!interest?.reads.length) return [];
  const seen = new Set(interest.reads.map((row) => row.id));
  if (excludeId) seen.add(excludeId);
  if (interest.lastId) seen.add(interest.lastId);
  return items
    .filter((item) => !seen.has(item.id))
    .map((item) => ({ item, score: matchScore(item, interest) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.item.publishedAt || "").localeCompare(a.item.publishedAt || "");
    })
    .map((row) => row.item);
}

export function formatNewsTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
