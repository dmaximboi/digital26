import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import {
  CATEGORY_LABELS,
  DICTIONARY_AMOUNT_USD,
  DICTIONARY_KEYWORDS,
  DICTIONARY_PATH,
  DICT_PAGE_SIZE,
  dictionaryCount,
  dictionaryEntries,
  dictionaryJsonLd,
  dictionaryLetters,
  entriesForLetter,
  pickRandom,
  readDictUnlock,
  searchDictionary,
  writeDictUnlock,
  type DictEntry,
} from "../lib/dictionary";
import { downloadDictionaryPdf, downloadStandaloneApp } from "../lib/dictionaryExport";
import { removeJsonLd, setJsonLd, setPageMeta } from "../lib/seo";
import { useT } from "../i18n/LocaleContext";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function DictionaryPage() {
  const t = useT();
  const [query, setQuery] = useState(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.trim() || "";
    return q;
  });
  const [letter, setLetter] = useState("");
  const [shown, setShown] = useState<DictEntry[]>(() => pickRandom());
  const [packOpen, setPackOpen] = useState(false);
  const [email, setEmail] = useState(() => readDictUnlock()?.email || "");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const letters = useMemo(() => dictionaryLetters(), []);
  const searching = query.trim().length > 0;

  const visible = useMemo(() => {
    if (searching) return searchDictionary(query).slice(0, 40);
    return shown;
  }, [query, searching, shown]);

  useEffect(() => {
    setPageMeta({
      title: t("dict.metaTitle"),
      description: t("dict.metaDesc"),
      path: DICTIONARY_PATH,
      keywords: DICTIONARY_KEYWORDS,
      robots: "index,follow,max-image-preview:large,max-snippet:-1",
    });
    setJsonLd("d26-jsonld-dictionary", dictionaryJsonLd());
    return () => removeJsonLd("d26-jsonld-dictionary");
  }, [t]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    const next = `${url.pathname}${url.search}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState({}, "", next);
    }
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("checkout_id")?.trim() || readDictUnlock()?.checkoutId || "";
    const cancelled = params.get("cancelled") === "1";
    if (cancelled) {
      setNotice(t("dict.cancelled"));
      setPackOpen(true);
    }
    if (!checkoutId && !email) return;

    let stopped = false;
    (async () => {
      try {
        if (checkoutId) {
          await fetch(
            `${API_BASE}/api/public/payments/sync?checkout_id=${encodeURIComponent(checkoutId)}`,
          );
        }
        const q = new URLSearchParams();
        if (email) q.set("email", email);
        if (checkoutId) q.set("checkout_id", checkoutId);
        const data = await apiGet<{ paid?: boolean }>(`/api/public/dictionary/access?${q}`);
        if (stopped) return;
        if (data.paid) {
          setPaid(true);
          setPackOpen(true);
          if (email && checkoutId) {
            writeDictUnlock({ email, checkoutId, paidAt: new Date().toISOString() });
          }
          setNotice(t("dict.unlocked"));
        }
      } catch {
        /* browsing stays free */
      } finally {
        if (checkoutId || cancelled) {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout_id");
          url.searchParams.delete("paid");
          url.searchParams.delete("cancelled");
          window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        }
      }
    })();
    return () => {
      stopped = true;
    };
  }, [email, t]);

  function shuffle(fromLetter = letter) {
    setQuery("");
    const pool = fromLetter ? entriesForLetter(fromLetter) : dictionaryEntries;
    setShown(pickRandom(DICT_PAGE_SIZE, pool));
  }

  function pickLetter(next: string) {
    const same = letter === next;
    const chosen = same ? "" : next;
    setLetter(chosen);
    setQuery("");
    const pool = chosen ? entriesForLetter(chosen) : dictionaryEntries;
    setShown(pickRandom(DICT_PAGE_SIZE, pool));
  }

  async function startPay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const data = await apiPost<{
        alreadyPaid?: boolean;
        paid?: boolean;
        checkoutUrl?: string;
        checkoutId?: string;
      }>("/api/public/dictionary/checkout", { email: email.trim() });
      if (data.alreadyPaid || data.paid) {
        setPaid(true);
        if (data.checkoutId) {
          writeDictUnlock({
            email: email.trim(),
            checkoutId: data.checkoutId,
            paidAt: new Date().toISOString(),
          });
        }
        setNotice(t("dict.unlocked"));
        return;
      }
      if (data.checkoutUrl) {
        if (data.checkoutId) {
          writeDictUnlock({
            email: email.trim(),
            checkoutId: data.checkoutId,
            paidAt: "",
          });
        }
        window.location.href = data.checkoutUrl;
        return;
      }
      setError(t("common.error"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const pack = dictionaryEntries;

  return (
    <section className="panel dict-page studio-page">
      <div className="dict-shell">
        <nav className="dict-az" aria-label={t("dict.az")}>
          <button
            type="button"
            className={!letter ? "is-active" : undefined}
            onClick={() => pickLetter("")}
          >
            {t("dict.all")}
          </button>
          {letters.map((item) => (
            <button
              key={item}
              type="button"
              className={letter === item ? "is-active" : undefined}
              onClick={() => pickLetter(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="dict-main">
          <header className="dict-head">
            <div>
              <p className="home-kicker">{t("dict.kicker")}</p>
              <h1>{t("dict.title")}</h1>
              <p className="lede">{t("dict.lede", { count: String(dictionaryCount) })}</p>
            </div>
            <button
              type="button"
              className="btn sm dict-pack-toggle"
              onClick={() => setPackOpen((v) => !v)}
            >
              {t("dict.download")}
            </button>
          </header>

          {packOpen && (
            <div className="dict-pack" id="dict-pay">
              {paid ? (
                <div className="cta-row">
                  <button type="button" className="btn primary sm" onClick={() => downloadDictionaryPdf(pack)}>
                    {t("dict.downloadPdf")}
                  </button>
                  <button type="button" className="btn sm" onClick={() => downloadStandaloneApp(pack)}>
                    {t("dict.downloadApp")}
                  </button>
                </div>
              ) : (
                <form className="dict-pay" onSubmit={(e) => void startPay(e)}>
                  <input
                    className="form-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("dict.email")}
                    aria-label={t("dict.email")}
                  />
                  <button type="submit" className="btn primary sm" disabled={busy}>
                    {busy ? t("dict.opening") : t("dict.payCta", { amount: DICTIONARY_AMOUNT_USD })}
                  </button>
                </form>
              )}
              {notice && <p className="form-success">{notice}</p>}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

          <div className="dict-toolbar">
            <label className="form-label dict-search">
              {t("dict.search")}
              <input
                className="form-input"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.trim()) setLetter("");
                }}
                placeholder={t("dict.searchPh")}
                autoComplete="off"
              />
            </label>
            <button type="button" className="btn dict-shuffle" onClick={() => shuffle()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 12a9 9 0 1 1-3.1-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
              {t("dict.shuffle")}
            </button>
          </div>

          <p className="muted dict-count">
            {searching
              ? t("dict.showing", { count: String(visible.length), total: String(dictionaryCount) })
              : t("dict.browse", { count: String(visible.length) })}
          </p>

          <dl className="dict-list">
            {visible.map((entry) => (
              <div key={entry.id} className="dict-entry">
                <dt>
                  {entry.term}
                  {entry.aka.length > 0 && <span> · {entry.aka.join(" · ")}</span>}
                </dt>
                <dd>
                  <p className="dict-cat">{CATEGORY_LABELS[entry.category] || entry.category}</p>
                  <p>{entry.definition}</p>
                </dd>
              </div>
            ))}
          </dl>

          {visible.length === 0 && <p className="muted">{t("dict.empty")}</p>}
        </div>
      </div>
    </section>
  );
}
