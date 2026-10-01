import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { quizDateFromKey, todayKey } from "./dailyQuiz.js";

export const NEWS_DAILY_COUNT = 20;

export type PublicNewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string | null;
};

type Incoming = {
  title: string;
  url: string;
  summary: string;
  source: string;
  publishedAt: Date | null;
};

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"].forEach((k) =>
      u.searchParams.delete(k),
    );
    return u.toString();
  } catch {
    return null;
  }
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asIncoming(row: unknown): Incoming | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const url = typeof item.url === "string" ? normalizeUrl(item.url) : null;
  if (!title || !url) return null;
  const summary =
    typeof item.summary === "string" && item.summary.trim() ? item.summary.trim() : title;
  const source =
    typeof item.source === "string" && item.source.trim() ? item.source.trim() : "Tech news";
  return {
    title: title.slice(0, 180),
    url,
    summary: summary.slice(0, 280),
    source: source.slice(0, 80),
    publishedAt: parseDate(item.publishedAt),
  };
}

async function gnewsPage(page: number, seen: Set<string>): Promise<Incoming[]> {
  const key = env.GNEWS_API_KEY?.trim();
  if (!key) {
    console.warn("[news.gnews] GNEWS_API_KEY missing");
    return [];
  }

  const url = new URL("https://gnews.io/api/v4/top-headlines");
  url.searchParams.set("category", "technology");
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");
  url.searchParams.set("page", String(page));
  url.searchParams.set("apikey", key);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[news.gnews]", page, res.status, errText.slice(0, 300));
    return [];
  }
  const data = (await res.json()) as {
    articles?: Array<{
      title?: string;
      description?: string;
      url?: string;
      source?: { name?: string };
      publishedAt?: string;
    }>;
  };
  const out: Incoming[] = [];
  for (const article of data.articles ?? []) {
    const item = asIncoming({
      title: article.title,
      url: article.url,
      summary: article.description,
      source: article.source?.name,
      publishedAt: article.publishedAt,
    });
    if (!item || seen.has(item.url)) continue;
    out.push(item);
  }
  return out;
}

async function fromGnews(seen: Set<string>): Promise<Incoming[]> {
  const first = await gnewsPage(1, seen);
  await new Promise((r) => setTimeout(r, 1200));
  const page2Seen = new Set(seen);
  for (const item of first) page2Seen.add(item.url);
  const second = await gnewsPage(2, page2Seen);
  return [...first, ...second];
}

function toPublic(row: {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date | null;
}): PublicNewsItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    source: row.source,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

export async function peekNewsPack(days = 3): Promise<PublicNewsItem[]> {
  const span = Math.min(Math.max(days, 1), 7);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (span - 1));
  const fromKey = start.toISOString().slice(0, 10);
  const rows = await prisma.dailyNewsItem.findMany({
    where: { newsDate: { gte: quizDateFromKey(fromKey) } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: NEWS_DAILY_COUNT * span,
  });
  if (rows.length === 0) return peekDailyNews();
  const seen = new Set<string>();
  const out: PublicNewsItem[] = [];
  for (const row of rows) {
    if (seen.has(row.url) || seen.has(row.id)) continue;
    seen.add(row.url);
    seen.add(row.id);
    out.push(toPublic(row));
  }
  return out;
}

export async function peekDailyNews(dateKey = todayKey()) {
  const newsDate = quizDateFromKey(dateKey);
  let rows = await prisma.dailyNewsItem.findMany({
    where: { newsDate },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: NEWS_DAILY_COUNT,
  });
  if (rows.length === 0) {
    const latest = await prisma.dailyNewsItem.findFirst({
      orderBy: { newsDate: "desc" },
      select: { newsDate: true },
    });
    if (latest) {
      rows = await prisma.dailyNewsItem.findMany({
        where: { newsDate: latest.newsDate },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: NEWS_DAILY_COUNT,
      });
    }
  }
  return rows.map(toPublic);
}

export async function ensureDailyNews(dateKey = todayKey()) {
  const newsDate = quizDateFromKey(dateKey);
  const existing = await prisma.dailyNewsItem.findMany({
    where: { newsDate },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  if (existing.length >= NEWS_DAILY_COUNT) {
    return existing.map(toPublic);
  }

  const seenUrls = new Set(
    (await prisma.dailyNewsItem.findMany({ select: { url: true } })).map((r) => r.url),
  );

  const incoming = await fromGnews(seenUrls);
  const fresh: Incoming[] = [];
  for (const item of incoming) {
    if (seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    fresh.push(item);
    if (existing.length + fresh.length >= NEWS_DAILY_COUNT) break;
  }

  if (fresh.length > 0) {
    await prisma.dailyNewsItem.createMany({
      data: fresh.map((item) => ({
        newsDate,
        url: item.url,
        title: item.title,
        summary: item.summary,
        source: item.source,
        publishedAt: item.publishedAt,
      })),
      skipDuplicates: true,
    });
  }

  const rows = await prisma.dailyNewsItem.findMany({
    where: { newsDate },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: NEWS_DAILY_COUNT,
  });
  return rows.map(toPublic);
}
