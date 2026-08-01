import { useEffect, useState } from "react";
import { apiPost } from "../lib/api";

type Props = {
  kind: "CERTIFICATE" | "AGREEMENT";
  publicId: string;
  amountUsd: string;
  onUnlocked?: () => void;
};

export function DocumentPaywall({ kind, publicId, amountUsd, onUnlocked }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("checkout_id");
    const paid = params.get("paid");
    if (!checkoutId && !paid) return;

    let cancelled = false;
    setSyncing(true);

    const sync = async () => {
      try {
        if (checkoutId) {
          const res = await fetch(
            `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api/public/payments/sync?checkout_id=${encodeURIComponent(checkoutId)}`,
          );
          const data = (await res.json().catch(() => ({}))) as { status?: string };
          if (!cancelled && data.status === "PAID") {
            onUnlocked?.();
          }
        } else if (paid === "1") {
          // Webhook may still be in flight — brief retry then reload.
          await new Promise((r) => setTimeout(r, 1200));
          if (!cancelled) onUnlocked?.();
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setSyncing(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout_id");
        url.searchParams.delete("paid");
        url.searchParams.delete("cancelled");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [onUnlocked]);

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const data = await apiPost<{
        checkoutUrl?: string;
        alreadyPaid?: boolean;
      }>("/api/public/payments/checkout", {
        kind,
        publicId,
        email: email.trim(),
        name: name.trim() || undefined,
      });
      if (data.alreadyPaid) {
        onUnlocked?.();
        return;
      }
      if (!data.checkoutUrl) throw new Error("No checkout URL returned");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed to start");
      setBusy(false);
    }
  }

  const label =
    kind === "CERTIFICATE" ? "certificate" : "agreement letter";

  return (
    <div className="doc-paywall">
      <h2>Unlock this {label}</h2>
      <p className="lede">
        One-time fee of <strong>${amountUsd} USD</strong>. Bachs converts to your local currency
        at checkout.
      </p>
      {syncing && <p className="muted">Confirming payment…</p>}
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
          />
        </label>
        <label>
          Full name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            autoComplete="name"
            placeholder="Optional"
          />
        </label>
        {error && (
          <p className="status error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={busy || syncing}>
          {busy ? "Redirecting…" : `Pay $${amountUsd}`}
        </button>
      </form>
    </div>
  );
}
