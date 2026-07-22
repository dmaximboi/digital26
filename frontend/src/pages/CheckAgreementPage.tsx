import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { DocBrandHeader } from "../components/BrandMark";
import { AgreementArt } from "../components/AgreementArt";

type AgreementPublic = {
  publicId: string;
  name: string;
  dealTag?: string | null;
  signedAt: string;
  signature: string;
};

const SITE =
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://digital26.online";

export function CheckAgreementPage() {
  const { publicId: routeId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(routeId ?? "");
  const [result, setResult] = useState<AgreementPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!routeId) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiGet<AgreementPublic>(`/api/public/a/${encodeURIComponent(routeId)}`)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult(null);
          setError(err instanceof Error ? err.message : "Lookup failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = input.trim();
    if (!id) return;
    navigate(`/check-agreement/${encodeURIComponent(id)}`);
  }

  return (
    <section className="panel">
      <DocBrandHeader title="Check agreement letter" />
      <p className="lede">Enter a public agreement ID (e.g. D26aB3xY9k).</p>

      <form className="lookup-form" onSubmit={onSubmit}>
        <label htmlFor="agrId">Agreement ID</label>
        <div className="lookup-row">
          <input
            id="agrId"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="D26aB3xY9k"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Checking…" : "Check"}
          </button>
        </div>
      </form>

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div aria-live="polite" style={{ marginTop: "1.5rem" }}>
          <AgreementArt
            publicId={result.publicId}
            displayName={result.name}
            dealTag={result.dealTag}
            signedAt={result.signedAt}
            signature={result.signature}
            checkUrl={`${SITE}/check-agreement/${result.publicId}`}
          />
        </div>
      )}
    </section>
  );
}
