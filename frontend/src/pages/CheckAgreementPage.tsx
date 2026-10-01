import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { publicLookupPath } from "../lib/checkoutProof";
import { DocBrandHeader } from "../components/BrandMark";
import { AgreementArt } from "../components/AgreementArt";
import { PublicRecordQr } from "../components/PublicRecordQr";
import { LockedDownload } from "../components/LockedDownload";
import { useT } from "../i18n/LocaleContext";
import { setPageMeta } from "../lib/seo";

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

export function CheckAgreementPage() {
  const t = useT();
  const { publicId: routeId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(routeId ?? "");
  const [result, setResult] = useState<AgreementPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: t("deals.title"),
      description: t("deals.metaDesc"),
      path: "/check-agreement",
    });
  }, [t]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AgreementPublic>(publicLookupPath("AGREEMENT", id));
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
      <DocBrandHeader title={t("deals.title")} />
      <p className="lede">{t("deals.lede")}</p>

      <form className="lookup-form verify-lookup" onSubmit={onSubmit}>
        <label htmlFor="agrId">{t("deals.id")}</label>
        <div className="lookup-row verify-lookup__row">
          <input
            id="agrId"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="D26aB3xY9k"
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            inputMode="text"
          />
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? t("verify.checking") : t("deals.btn")}
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
