import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyDocumentLocale, detectLocale, storeLocale } from "./detect";
import type { Locale } from "./types";
import { en, type MessageKey } from "./locales/en";
import { fr } from "./locales/fr";
import { ar } from "./locales/ar";

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, fr, ar };

type Vars = Record<string, string | number>;

type LocaleContextValue = {
  locale: Locale;
  ready: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : "",
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const detected = await detectLocale();
      if (cancelled) return;
      setLocaleState(detected);
      applyDocumentLocale(detected);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
    applyDocumentLocale(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const raw = catalogs[locale][key] ?? catalogs.en[key] ?? key;
      return interpolate(raw, vars);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, ready, setLocale, t }),
    [locale, ready, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useT() {
  return useLocale().t;
}
