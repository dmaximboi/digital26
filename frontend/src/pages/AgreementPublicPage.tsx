import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { publicLookupPath } from "../lib/checkoutProof";
import { DocBrandHeader } from "../components/BrandMark";
import { AgreementArt } from "../components/AgreementArt";
import { PublicRecordQr } from "../components/PublicRecordQr";
import { LockedDownload } from "../components/LockedDownload";

type AgreementPublic = {
  publicId: string;
  name: string;
  dealTag?: string | null;
  signedAt: string | null;
  signature: string | null;
  accessPaid?: boolean;
  amountUsd?: string;
  canDownloadTemplatePng?: boolean;
  downloadConsumed?: boolean;
  downloadToken?: string | null;
};

const SITE =
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://digital26.online";

export function AgreementPublicPage() {
  const { publicId } = useParams();
  const [result, setResult] = useState<AgreementPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AgreementPublic>(publicLookupPath("AGREEMENT", id));
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!publicId) return;
    void load(publicId);
  }, [publicId, load]);

  return (
    <section className="panel">
      <DocBrandHeader title="Agreement letter" />
      {loading && <p>Loading…</p>}
      {error && <p className="status error">{error}</p>}
      {result && (
        <div className="verify-result">
          <p className="muted">ID: {result.publicId}</p>
          <AgreementArt
            publicId={result.publicId}
            displayName={result.name}
            dealTag={result.dealTag}
            signedAt={result.signedAt || ""}
            signature={result.signature || ""}
            checkUrl={`${SITE}/check-agreement/${result.publicId}`}
          />
          <PublicRecordQr url={`${SITE}/check-agreement/${result.publicId}`} />
          <LockedDownload
            kind="AGREEMENT"
            publicId={result.publicId}
            amountUsd={result.amountUsd || "1.00"}
            canDownload={Boolean(result.canDownloadTemplatePng)}
            downloadConsumed={Boolean(result.downloadConsumed)}
            downloadToken={result.downloadToken}
            onUnlocked={() => void load(result.publicId)}
            onConsumed={() =>
              setResult((prev) =>
                prev
                  ? {
                      ...prev,
                      canDownloadTemplatePng: false,
                      downloadToken: null,
                      downloadConsumed: true,
                    }
                  : prev,
              )
            }
          />
        </div>
      )}
    </section>
  );
}
