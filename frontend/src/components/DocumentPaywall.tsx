import { useCallback, useEffect, useState } from "react";
import { useT } from "../i18n/LocaleContext";
import { apiPost } from "../lib/api";

type Props = {
  kind: "CERTIFICATE" | "AGREEMENT";
  publicId: string;
  amountUsd: string;
  compact?: boolean;
  onUnlocked?: () => void;
};

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function storageKey(kind: string, publicId: string) {
  return `d26_checkout_${kind}_${publicId}`;
}

export function DocumentPaywall({ kind, publicId, amountUsd, compact, onUnlocked }: Props) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkoutId, setCheckoutId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(storageKey(kind, publicId));
    } catch {
      return null;
    }
  });

  const unlockTitle =
    kind === "CERTIFICATE" ? t("paywall.unlockCert") : t("paywall.unlockAgreement");
  const lede =
    kind === "CERTIFICATE" ? t("paywall.ledeCert") : t("paywall.ledeAgreement");
  const cta =
    kind === "CERTIFICATE"
      ? t("paywall.ctaCert", { amount: amountUsd })
      : t("paywall.ctaAgreement", { amount: amountUsd });

  const syncCheckout = useCallback(
    async (id?: string | null) => {
      const cid = (id || checkoutId || "").trim();
      if (!cid) return { status: null as string | null };

      const res = await fetch(
        `${API_BASE}/api/public/payments/sync?checkout_id=${encodeURIComponent(cid)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        status?: string | null;
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) throw new Error(data.error || t("common.error"));
      if (data.status === "PAID") {
        try {
          sessionStorage.removeItem(storageKey(kind, publicId));
        } catch {
          /* ignore */
        }
        onUnlocked?.();
      }
      return { status: data.status ?? null };
    },
    [checkoutId, kind, onUnlocked, publicId, t],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedId = params.get("checkout_id");
    const paid = params.get("paid");
    const cancelled = params.get("cancelled");
    if (!returnedId && !paid && cancelled !== "1") return;

    let stopped = false;
    let timer: number | undefined;

    (async () => {
      if (cancelled === "1") {
        setNotice(t("paywall.cancelled"));
      } else {
        setNotice(t("paywall.confirming"));
        if (returnedId) {
          try {
            sessionStorage.setItem(storageKey(kind, publicId), returnedId);
          } catch {
            /* ignore */
          }
          setCheckoutId(returnedId);
        }
        try {
          const result = await syncCheckout(returnedId);
          if (stopped) return;
          if (result.status === "PAID") {
            setNotice(t("paywall.unlocked"));
            return;
          }
          setNotice(t("pay.notice.confirming"));
        } catch (err) {
          if (!stopped) {
            setError(err instanceof Error ? err.message : t("common.error"));
            setNotice("");
          }
        }
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("checkout_id");
      url.searchParams.delete("paid");
      url.searchParams.delete("cancelled");
      window.history.replaceState({}, "", url.pathname + url.search);

      if (cancelled === "1" || stopped) return;

      let polls = 0;
      timer = window.setInterval(() => {
        polls += 1;
        void (async () => {
          try {
            const result = await syncCheckout(returnedId);
            if (stopped) return;
            if (result.status === "PAID" || polls >= 10) {
              if (timer) window.clearInterval(timer);
              if (result.status === "PAID") {
                setNotice(t("paywall.unlocked"));
              } else if (polls >= 10) {
                setNotice(t("pay.notice.stillUnpaid"));
              }
            }
          } catch {
            if (polls >= 10 && timer) window.clearInterval(timer);
          }
        })();
      }, 2500);
    })();

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
    };
  }, [kind, publicId, syncCheckout, t]);

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      // If we have a prior checkout, verify it before creating another.
      if (checkoutId) {
        const prior = await syncCheckout(checkoutId);
        if (prior.status === "PAID") {
          setBusy(false);
          return;
        }
      }

      const data = await apiPost<{
        checkoutUrl?: string;
        checkoutId?: string;
        alreadyPaid?: boolean;
      }>("/api/public/payments/checkout", {
        kind,
        publicId,
        email: email.trim(),
        name: name.trim() || undefined,
      });

      if (data.alreadyPaid) {
        setNotice(t("pay.notice.already"));
        onUnlocked?.();
        setBusy(false);
        return;
      }
      if (!data.checkoutUrl) throw new Error(t("common.error"));
      if (data.checkoutId) {
        try {
          sessionStorage.setItem(storageKey(kind, publicId), data.checkoutId);
        } catch {
          /* ignore */
        }
        setCheckoutId(data.checkoutId);
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  async function verifyAgain() {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setError("");
    setNotice(t("paywall.checking"));
    try {
      const result = await syncCheckout(checkoutId);
      if (result.status === "PAID") {
        setNotice(t("paywall.unlocked"));
      } else {
        setNotice(t("pay.notice.stillUnpaid"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setNotice("");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div className={`doc-paywall${compact ? " doc-paywall--compact" : ""}`}>
      <div className="doc-paywall__hero">
        <div>
          <p className="doc-paywall__eyebrow">{t("paywall.eyebrow")}</p>
          <h2>{unlockTitle}</h2>
          <p className="lede">{lede}</p>
        </div>
        <div className="doc-paywall__price">
          <span>{t("paywall.amount")}</span>
          <strong>${amountUsd}</strong>
          <em>USD</em>
        </div>
      </div>

      {notice && <p className="payment-notice">{notice}</p>}
      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <form className="doc-paywall__form" onSubmit={(e) => void startCheckout(e)}>
        <label>
          {t("paywall.email")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            autoComplete="email"
            placeholder="you@email.com"
          />
        </label>
        <label>
          {t("paywall.name")} <span className="muted">{t("paywall.optional")}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            autoComplete="name"
          />
        </label>

        <button
          className="btn primary payment-cta doc-paywall__cta"
          type="submit"
          disabled={busy || verifyBusy}
        >
          {busy ? t("paywall.opening") : cta}
        </button>
      </form>

      <div className="doc-paywall__actions">
        <button
          type="button"
          className="btn"
          disabled={busy || verifyBusy}
          onClick={() => void verifyAgain()}
        >
          {verifyBusy ? t("paywall.checking") : t("paywall.verifyAgain")}
        </button>
        <p className="muted doc-paywall__note">{t("paywall.note")}</p>
      </div>
    </div>
  );
}
