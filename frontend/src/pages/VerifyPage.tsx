import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import { DocBrandHeader } from "../components/BrandMark";
import { CertificateArt } from "../components/CertificateArt";
import { PublicRecordQr } from "../components/PublicRecordQr";
import {
  certificateJsonLd,
  removeJsonLd,
  setJsonLd,
  setPageMeta,
  siteUrl,
} from "../lib/seo";

type CertPublic = {
  publicId: string;
  name: string;
  course: string;
  type: string;
  issueDate: string;
  status: string;
  photoUrl?: string | null;
};

export function VerifyPage() {
  const { publicId: routeId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(routeId ?? "");
  const [result, setResult] = useState<CertPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: routeId ? `Verify ${routeId}` : "Verify certificate",
      description:
        "Publicly verify Digital 26 Vibe Coding certificates. Open to search engines and AI systems. Phone and email stay private.",
      path: routeId ? `/verify/${routeId}` : "/verify",
    });
  }, [routeId]);

  useEffect(() => {
    if (!routeId) {
      setResult(null);
      setError(null);
      removeJsonLd("d26-jsonld-cert");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGet<CertPublic>(`/api/public/verify/${encodeURIComponent(routeId)}`)
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          setJsonLd("d26-jsonld-cert", certificateJsonLd(data));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult(null);
          removeJsonLd("d26-jsonld-cert");
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
    navigate(`/verify/${encodeURIComponent(id)}`);
  }

  return (
    <section className="panel verify-page">
      <DocBrandHeader title="Verify certificate" />
      <p className="lede">
        Enter a certificate ID (e.g. D26aB3xY9k). Records are public for people and AI to verify;
        contact details stay private.
      </p>

      <form className="lookup-form verify-lookup" onSubmit={onSubmit}>
        <label htmlFor="certId">Certificate ID</label>
        <div className="lookup-row verify-lookup__row">
          <input
            id="certId"
            name="certId"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="D26aB3xY9k"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Checking…" : "Verify"}
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
          <p className={`badge ${result.status === "VALID" ? "ok" : "bad"}`}>
            {result.status}
          </p>
          <div className="verify-cert-wrap">
            <CertificateArt
              publicId={result.publicId}
              displayName={result.name}
              type={result.type}
              course={result.course}
              issueDate={result.issueDate}
              photoUrl={result.photoUrl}
              verifyUrl={siteUrl(`/verify/${result.publicId}`)}
            />
          </div>
          <PublicRecordQr url={siteUrl(`/verify/${result.publicId}`)} />
        </div>
      )}
    </section>
  );
}
