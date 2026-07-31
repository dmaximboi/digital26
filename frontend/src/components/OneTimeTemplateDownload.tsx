import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

type Props = {
  kind: "certificate" | "agreement";
  publicId: string;
  available: boolean;
  downloadToken?: string | null;
  onConsumed?: () => void;
};

export function OneTimeTemplateDownload({
  kind,
  publicId,
  available,
  downloadToken,
  onConsumed,
}: Props) {
  const [visible, setVisible] = useState(available && Boolean(downloadToken));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState(downloadToken || "");

  useEffect(() => {
    setVisible(available && Boolean(downloadToken));
    setToken(downloadToken || "");
    setError("");
  }, [available, publicId, downloadToken]);

  if (!visible) return null;

  async function download() {
    if (busy || !token) return;
    setBusy(true);
    setError("");
    try {
      const path =
        kind === "certificate"
          ? `/api/public/verify/${encodeURIComponent(publicId)}/template-png`
          : `/api/public/a/${encodeURIComponent(publicId)}/template-png`;
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 410) {
        setVisible(false);
        onConsumed?.();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${publicId}-template.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setVisible(false);
      onConsumed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="one-time-dl">
      <button type="button" className="btn primary" disabled={busy || !token} onClick={() => void download()}>
        {busy ? "Preparing PNG…" : "Download template PNG (one time)"}
      </button>
      <p className="muted one-time-dl__hint">
        Exact on-screen template with QR. Secured one-time download — button disappears forever after use.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
