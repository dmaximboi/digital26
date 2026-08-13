import type { Locale } from "./types";
import { LOCALES } from "./types";

const STORAGE_KEY = "d26_locale";

const FRENCH_COUNTRIES = new Set([
  "FR", "BE", "CH", "LU", "MC", "SN", "CI", "CM", "ML", "BF", "NE", "TG", "BJ",
  "GA", "CG", "CD", "MG", "HT", "GP", "MQ", "RE", "GF", "NC", "PF", "YT", "PM",
  "WF", "BI", "DJ", "TD", "CF", "GN", "RW", "SC", "KM",
]);

const ARABIC_COUNTRIES = new Set([
  "SA", "AE", "EG", "MA", "DZ", "TN", "IQ", "JO", "KW", "QA", "BH", "OM", "LY",
  "SD", "YE", "SY", "LB", "PS", "MR", "SO", "DJ", "KM", "EH",
]);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

function localeFromBrowser(): Locale | null {
  const tags = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "fr") return "fr";
    if (base === "ar") return "ar";
    if (base === "en") return "en";
  }
  return null;
}

function localeFromCountry(code: string): Locale | null {
  const c = code.toUpperCase();
  if (ARABIC_COUNTRIES.has(c)) return "ar";
  if (FRENCH_COUNTRIES.has(c)) return "fr";
  return null;
}

function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController();
  window.setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/** Soft IP → country lookup (no API key). Fails quietly. */
async function localeFromLocation(): Promise<Locale | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: withTimeout(4500),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as { country_code?: string };
      if (data.country_code) return localeFromCountry(data.country_code);
    }
  } catch {
    /* try fallback */
  }

  try {
    const res = await fetch("https://ipwho.is/", {
      signal: withTimeout(4500),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as { country_code?: string; success?: boolean };
      if (data.success !== false && data.country_code) {
        return localeFromCountry(data.country_code);
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Resolve initial locale:
 * 1) saved preference
 * 2) IP/location country
 * 3) browser language
 * 4) English
 */
export async function detectLocale(): Promise<Locale> {
  const stored = readStoredLocale();
  if (stored) return stored;

  const fromLocation = await localeFromLocation();
  if (fromLocation) return fromLocation;

  return localeFromBrowser() || "en";
}

export function applyDocumentLocale(locale: Locale): void {
  const root = document.documentElement;
  root.lang = locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en";
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.dataset.locale = locale;
}
