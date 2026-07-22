import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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

export function AgreementPublicPage() {
  const { publicId } = useParams();
  const [result, setResult] = useState<AgreementPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicId) return;

    let cancelled = false;
    setLoading(true);

    apiGet<AgreementPublic>(`/api/public/a/${encodeURIComponent(publicId)}`)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Lookup failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  return (
    <section className="panel">
      <DocBrandHeader title="Agreement letter" />
      {loading && <p>Loading…</p>}
      {error && <p className="status error">{error}</p>}
      {result && (
        <div style={{ marginTop: "1rem" }}>
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
