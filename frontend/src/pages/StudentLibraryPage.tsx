import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { apiGet, apiPost } from "../lib/api";
import { setPageMeta } from "../lib/seo";

const EMAIL_KEY = "d26_library_email";

type LibItem = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string;
  isFree: boolean;
  priceUsd: string | null;
  unlocked: boolean;
};

function readEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function StudentLibraryPage() {
  const t = useT();
  const { user } = useAuth();
  const [items, setItems] = useState<LibItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [email, setEmail] = useState(() => user?.email || readEmail());

  useEffect(() => {
    setPageMeta({
      title: t("library.title"),
      description: t("library.metaDesc"),
      path: "/library",
    });
  }, [t]);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const load = useCallback(async (receiptEmail: string, checkoutId = "") => {
    const q = new URLSearchParams();
    if (receiptEmail.trim()) q.set("email", receiptEmail.trim());
    if (checkoutId) q.set("checkout_id", checkoutId);
    const data = await apiGet<{ items: LibItem[] }>(`/api/public/library?${q}`);
    setItems(data.items);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("checkout_id")?.trim() || "";
    const receipt = user?.email || readEmail();

    (async () => {
      setFetching(true);
      setError("");
      try {
        await load(receipt, checkoutId);
        if (checkoutId) {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout_id");
          url.searchParams.delete("paid");
          url.searchParams.delete("cancelled");
          window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        setFetching(false);
      }
    })();
  }, [load, t, user?.email]);

  function rememberEmail(next: string) {
    setEmail(next);
    try {
      if (next.trim()) localStorage.setItem(EMAIL_KEY, next.trim());
    } catch {
      /* ignore */
    }
  }

  async function openItem(item: LibItem) {
    if (busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      if (!item.unlocked) {
        if (!email.trim()) {
          setError(t("library.needEmail"));
          return;
        }
        const checkout = await apiPost<{
          checkoutUrl?: string;
          alreadyPaid?: boolean;
          free?: boolean;
          checkoutId?: string;
        }>(`/api/public/library/${item.id}/checkout`, { email: email.trim() });
        rememberEmail(email);
        if (checkout.checkoutUrl) {
          window.location.href = checkout.checkoutUrl;
          return;
        }
        await load(email.trim());
      }

      const opened = await apiPost<{ viewUrl: string }>(`/api/public/library/${item.id}/open`, {
        email: email.trim(),
      });
      if (!opened.viewUrl) throw new Error(t("common.error"));
      window.open(opened.viewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  }

  if (fetching) {
    return (
      <section className="panel library-page" aria-busy="true">
        <p className="muted">{t("library.loading")}</p>
      </section>
    );
  }

  const backTo = user?.role === "STUDENT" && user.hasProfile ? "/dashboard" : "/";

  return (
    <section className="panel library-page studio-page">
      <Link to={backTo} className="back-link">
        &larr; {user?.role === "STUDENT" && user.hasProfile ? t("library.back") : t("nav.home")}
      </Link>
      <p className="home-kicker">{t("dash.kicker")}</p>
      <h1>{t("library.title")}</h1>
      <p className="lede">{t("library.publicLede")}</p>

      <label className="form-label library-email">
        {t("library.email")}
        <input
          className="form-input"
          type="email"
          value={email}
          onChange={(e) => rememberEmail(e.target.value)}
          placeholder={t("library.email")}
          autoComplete="email"
        />
      </label>

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 && <p className="muted">{t("library.empty")}</p>}

      <div className="library-grid">
        {items.map((item) => (
          <article key={item.id} className="library-card">
            <div className="library-card__cover">
              <img src={item.coverUrl} alt="" />
              <span className={`library-card__badge ${item.unlocked ? "ok" : "lock"}`}>
                {item.isFree
                  ? t("library.free")
                  : item.unlocked
                    ? t("library.included")
                    : `$${item.priceUsd}`}
              </span>
            </div>
            <div className="library-card__body">
              <h2>{item.title}</h2>
              {item.description && <p className="muted">{item.description}</p>}
              <button
                type="button"
                className="btn primary"
                disabled={busyId === item.id}
                onClick={() => void openItem(item)}
              >
                {busyId === item.id
                  ? t("library.opening")
                  : item.unlocked
                    ? t("common.open")
                    : t("library.getAccess", { amount: item.priceUsd ?? "" })}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
