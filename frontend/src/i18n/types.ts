export type Locale = "en" | "fr" | "ar";

export type Dict = Record<string, string>;

export const LOCALES: Locale[] = ["en", "fr", "ar"];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  ar: "ع",
};
