import pack from "../data/techDictionary.json";
import { siteUrl } from "./seo";

export type DictCategory =
  | "git"
  | "github"
  | "web"
  | "js"
  | "css"
  | "html"
  | "http"
  | "db"
  | "devops"
  | "cloud"
  | "security"
  | "net"
  | "ai"
  | "arch"
  | "tool"
  | "data"
  | "mobile"
  | "os"
  | "test"
  | "career";

export type DictEntry = {
  id: string;
  term: string;
  aka: string[];
  category: DictCategory | string;
  definition: string;
};

export const DICTIONARY_PUBLIC_ID = "D26DICTPACK";
export const DICTIONARY_AMOUNT_USD = "1.00";
export const DICTIONARY_UNLOCK_KEY = "d26_dict_unlock";
export const DICTIONARY_PATH = "/dictionary";
export const DICTIONARY_ALIASES = ["/glossary", "/tech-dictionary", "/tech-terms", "/terminology"];
export const DICTIONARY_KEYWORDS =
  "tech dictionary, programming glossary, tech terminology, software terms, coding vocabulary, developer dictionary, Git terms, GitHub terms, HTTP status codes, JavaScript dictionary, CSS glossary, HTML elements, web development terms, tech terms lookup, programming definitions";

export const CATEGORY_LABELS: Record<string, string> = {
  git: "Git",
  github: "GitHub",
  web: "Web",
  js: "JavaScript",
  css: "CSS",
  html: "HTML",
  http: "HTTP",
  db: "Data stores",
  devops: "DevOps",
  cloud: "Cloud",
  security: "Security",
  net: "Networks",
  ai: "AI",
  arch: "Architecture",
  tool: "Tools",
  data: "Data",
  mobile: "Mobile",
  os: "Systems",
  test: "Testing",
  career: "Studio craft",
};

export const dictionaryEntries = (pack as { entries: DictEntry[] }).entries;
export const dictionaryCount = dictionaryEntries.length;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function letterOf(term: string): string {
  const ch = term.replace(/^[^A-Za-z0-9]+/, "")[0];
  if (!ch) return "#";
  return /[A-Za-z]/.test(ch) ? ch.toUpperCase() : "#";
}

export function dictionaryLetters(): string[] {
  const have = new Set(dictionaryEntries.map((e) => letterOf(e.term)));
  return [...LETTERS.filter((l) => have.has(l)), ...(have.has("#") ? ["#"] : [])];
}

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9#+./<>]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);
}

function haystack(entry: DictEntry): string {
  return `${entry.term} ${entry.aka.join(" ")} ${entry.category} ${CATEGORY_LABELS[entry.category] || ""} ${entry.definition}`.toLowerCase();
}

export function searchDictionary(query: string, category = "all"): DictEntry[] {
  const cat = category === "all" ? "" : category;
  const pool = cat ? dictionaryEntries.filter((e) => e.category === cat) : dictionaryEntries;
  const q = query.trim();
  if (!q) return pool;

  const parts = tokens(q);
  const lower = q.toLowerCase();
  const scored = pool
    .map((entry) => {
      const term = entry.term.toLowerCase();
      const aliases = entry.aka.map((a) => a.toLowerCase());
      const blob = haystack(entry);
      let score = 0;
      if (term === lower || aliases.includes(lower)) score += 1000;
      else if (term.startsWith(lower)) score += 400;
      else if (aliases.some((a) => a.startsWith(lower))) score += 320;
      else if (term.includes(lower)) score += 180;
      const hit = parts.every((p) => blob.includes(p));
      if (!hit && score === 0) return null;
      if (hit) score += 40 + parts.reduce((n, p) => n + (term.includes(p) ? 20 : 0), 0);
      return { entry, score };
    })
    .filter((row): row is { entry: DictEntry; score: number } => Boolean(row))
    .sort((a, b) => b.score - a.score || a.entry.term.localeCompare(b.entry.term));

  return scored.map((row) => row.entry);
}

export const DICT_PAGE_SIZE = 20;

export function pickRandom(count = DICT_PAGE_SIZE, pool: DictEntry[] = dictionaryEntries): DictEntry[] {
  const copy = pool.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a && b) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function entriesForLetter(letter: string): DictEntry[] {
  return dictionaryEntries.filter((entry) => letterOf(entry.term) === letter);
}

export function groupByLetter(entries: DictEntry[]): Array<{ letter: string; items: DictEntry[] }> {
  const map = new Map<string, DictEntry[]>();
  for (const entry of entries) {
    const letter = letterOf(entry.term);
    const list = map.get(letter);
    if (list) list.push(entry);
    else map.set(letter, [entry]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === "#" ? 1 : b[0] === "#" ? -1 : a[0].localeCompare(b[0])))
    .map(([letter, items]) => ({ letter, items }));
}

export type DictUnlock = { email: string; checkoutId: string; paidAt: string };

export function readDictUnlock(): DictUnlock | null {
  try {
    const raw = localStorage.getItem(DICTIONARY_UNLOCK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DictUnlock;
    if (!data?.email || !data?.checkoutId) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeDictUnlock(unlock: DictUnlock): void {
  try {
    localStorage.setItem(DICTIONARY_UNLOCK_KEY, JSON.stringify(unlock));
  } catch {
    /* ignore */
  }
}

export function dictionaryJsonLd(): Record<string, unknown>[] {
  const url = siteUrl(DICTIONARY_PATH);
  const step = Math.max(1, Math.floor(dictionaryEntries.length / 24));
  const sample = dictionaryEntries.filter((_, i) => i % step === 0).slice(0, 24);

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tech dictionary and glossary",
      url,
      inLanguage: "en",
      isAccessibleForFree: true,
      description:
        "Public tech dictionary for programming terminology. Search Git, GitHub, HTTP, JavaScript, CSS, security, and studio terms.",
      keywords: DICTIONARY_KEYWORDS,
      about: ["programming glossary", "tech terminology", "software dictionary"],
      significantLink: DICTIONARY_ALIASES.map((path) => siteUrl(path)),
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: [".dict-head h1", ".dict-head .lede"],
      },
      isPartOf: {
        "@type": "WebSite",
        name: "The Digital 26",
        url: siteUrl("/"),
      },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${url}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      name: "The Digital 26 Tech Dictionary",
      alternateName: ["Tech glossary", "Programming terminology", "Studio tech terms"],
      description:
        "Working definitions for Git, GitHub, HTTP, JavaScript, CSS, HTML, security, DevOps, and studio words. Free to read.",
      url,
      inLanguage: "en",
      numberOfItems: dictionaryCount,
      hasDefinedTerm: sample.map((entry) => ({
        "@type": "DefinedTerm",
        name: entry.term,
        description: entry.definition.slice(0, 220),
        termCode: entry.id,
        inDefinedTermSet: url,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Tech dictionary", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Where can I look up tech terms or a programming dictionary?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `Open ${url}. It is the public Digital 26 tech dictionary. Search or shuffle more than ${dictionaryCount} working terms. No account is required.`,
          },
        },
        {
          "@type": "Question",
          name: "Is the Digital 26 tech dictionary free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Reading and searching the dictionary is free. A $1 download unlocks the PDF and a standalone HTML copy.",
          },
        },
        {
          "@type": "Question",
          name: "What terminology does this glossary cover?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Git, GitHub, HTTP status codes, JavaScript, CSS, HTML, databases, DevOps, cloud, security, networks, AI, and studio craft words.",
          },
        },
      ],
    },
  ];
}
