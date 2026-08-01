import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { DocBrandHeader } from "../components/BrandMark";
import { AgreementArt } from "../components/AgreementArt";
import { PublicRecordQr } from "../components/PublicRecordQr";
import { OneTimeTemplateDownload } from "../components/OneTimeTemplateDownload";
import { DocumentPaywall } from "../components/DocumentPaywall";

type AgreementPublic = {
  publicId: string;
  name: string;
  dealTag?: string | null;
  signedAt: string | null;
  signature: string | null;
  accessPaid?: boolean;
  amountUsd?: string;
  canDownloadTemplatePng?: boolean;
  downloadToken?: string | null;
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

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AgreementPublic>(`/api/public/a/${encodeURIComponent(id)}`);
      setResult(data);
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!routeId) {
      setResult(null);
      setError(null);
      return;
    }
    void load(routeId);
  }, [routeId, load]);

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
        <div className="verify-result" aria-live="polite">
          <p className="muted">ID: {result.publicId}</p>
          {!result.accessPaid ? (
            <DocumentPaywall
              kind="AGREEMENT"
              publicId={result.publicId}
              amountUsd={result.amountUsd || "1.00"}
              onUnlocked={() => void load(result.publicId)}
            />
          ) : (
            <>
              <AgreementArt
                publicId={result.publicId}
                displayName={result.name}
                dealTag={result.dealTag}
                signedAt={result.signedAt || ""}
                signature={result.signature || ""}
                checkUrl={`${SITE}/check-agreement/${result.publicId}`}
              />
              <PublicRecordQr url={`${SITE}/check-agreement/${result.publicId}`} />
              <OneTimeTemplateDownload
                kind="agreement"
                publicId={result.publicId}
                available={Boolean(result.canDownloadTemplatePng)}
                downloadToken={result.downloadToken}
                onConsumed={() =>
                  setResult((prev) =>
                    prev ? { ...prev, canDownloadTemplatePng: false, downloadToken: null } : prev,
                  )
                }
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
