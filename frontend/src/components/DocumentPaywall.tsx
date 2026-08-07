import { useCallback, useEffect, useState } from "react";
import { apiPost } from "../lib/api";

type Props = {
  kind: "CERTIFICATE" | "AGREEMENT";
  publicId: string;
  amountUsd: string;
  onUnlocked?: () => void;
};

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function storageKey(kind: string, publicId: string) {
  return `d26_checkout_${kind}_${publicId}`;
}

export function DocumentPaywall({ kind, publicId, amountUsd, onUnlocked }: Props) {
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

  const label = kind === "CERTIFICATE" ? "certificate" : "agreement letter";
  const cta =
    kind === "CERTIFICATE"
      ? `Pay $${amountUsd} to unlock & download`
      : `Pay $${amountUsd} to unlock`;

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
      if (!res.ok) throw new Error(data.error || "Could not verify payment");
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
    [checkoutId, kind, onUnlocked, publicId],
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
        setNotice("Checkout cancelled. You can try again.");
      } else {
        setNotice("Confirming payment with Bachs…");
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
            setNotice("Payment verified. Unlocking…");
            return;
          }
          setNotice("Returned from checkout — still confirming with Bachs…");
        } catch (err) {
          if (!stopped) {
            setError(err instanceof Error ? err.message : "Payment verify failed");
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
                setNotice("Payment verified. Unlocking…");
              } else if (polls >= 10) {
                setNotice("Still unpaid on our side. Tap “I already paid” if Bachs succeeded.");
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
  }, [kind, publicId, syncCheckout]);

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
        setNotice("Already paid — unlocking…");
        onUnlocked?.();
        setBusy(false);
        return;
      }
      if (!data.checkoutUrl) throw new Error("No checkout URL returned");
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
      setError(err instanceof Error ? err.message : "Payment failed to start");
      setBusy(false);
    }
  }

  async function verifyAgain() {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setError("");
    setNotice("Re-checking Bachs…");
    try {
      const result = await syncCheckout(checkoutId);
      if (result.status === "PAID") {
        setNotice("Payment verified. Unlocking…");
      } else {
        setNotice(
          "Still unpaid on our side. If Bachs shows success, wait a minute and tap again.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
      setNotice("");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div className="doc-paywall">
      <div className="doc-paywall__hero">
        <div>
          <p className="doc-paywall__eyebrow">One-time unlock</p>
          <h2>Download this {label}</h2>
          <p className="lede">
            Pay once to unlock the full {label} and download.
          </p>
        </div>
        <div className="doc-paywall__price">
          <span>Amount</span>
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
          Email for receipt
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
          Full name <span className="muted">(optional)</span>
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
          {busy ? "Opening secure checkout…" : cta}
        </button>
      </form>

      <div className="doc-paywall__actions">
        <button
          type="button"
          className="btn"
          disabled={busy || verifyBusy}
          onClick={() => void verifyAgain()}
        >
          {verifyBusy ? "Checking…" : "I already paid — verify again"}
        </button>
        <p className="muted doc-paywall__note">
          Checkout is hosted by Bachs. After you pay, we confirm the charge with Bachs before
          unlocking — not from the redirect alone.
        </p>
      </div>
    </div>
  );
}
