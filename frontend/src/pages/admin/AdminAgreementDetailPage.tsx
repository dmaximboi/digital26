import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminDownloadPdf, adminFetch } from "../../lib/adminApi";

type Detail = {
  id: string;
  publicId: string | null;
  dealType: string;
  otherDealText: string | null;
  signatureName: string | null;
  signedAt: string | null;
  requestingIp: string | null;
  pdfUrl: string | null;
  hasNin: boolean;
  person: { id: string; name: string };
  publicCard: { publicId: string } | null;
};

type Contact = { email: string | null; phone: string | null };

export function AdminAgreementDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealBusy, setRevealBusy] = useState(false);

  useEffect(() => {
    adminFetch<Detail>(`/api/admin/agreements/${id}`)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
  }, [id]);

  async function download() {
    if (!data?.publicId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminDownloadPdf("agreements", data.publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (!data?.person.id || revealBusy) return;
    setRevealBusy(true);
    setError(null);
    try {
      const c = await adminFetch<Contact & { id: string; name: string }>(
        `/api/admin/people/${encodeURIComponent(data.person.id)}/reveal-contact`,
        { method: "POST", body: "{}" },
      );
      setContact({ email: c.email, phone: c.phone });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reveal failed");
    } finally {
      setRevealBusy(false);
    }
  }

  if (error && !data) return <p className="status error">{error}</p>;
  if (!data) return <p>Loading…</p>;

  return (
    <article className="result-card">
      <h2>{data.person.name}</h2>
      {error && <p className="status error">{error}</p>}
      <dl>
        <div>
          <dt>Contact</dt>
          <dd>
            {contact ? (
              <>
                {contact.email ?? "n/a"} · {contact.phone ?? "n/a"}
              </>
            ) : (
              <button type="button" className="btn" disabled={revealBusy} onClick={() => void reveal()}>
                {revealBusy ? "Revealing…" : "Reveal email / phone"}
              </button>
            )}
          </dd>
        </div>
        <div>
          <dt>Deal</dt>
          <dd>{data.otherDealText || data.dealType}</dd>
        </div>
        <div>
          <dt>Public ID</dt>
          <dd>{data.publicId ?? "n/a"}</dd>
        </div>
        <div>
          <dt>Signature</dt>
          <dd>{data.signatureName ?? "n/a"}</dd>
        </div>
        <div>
          <dt>IP</dt>
          <dd>{data.requestingIp ?? "n/a"}</dd>
        </div>
        <div>
          <dt>NIN stored</dt>
          <dd>{data.hasNin ? "yes (encrypted)" : "no"}</dd>
        </div>
        <div>
          <dt>PDF</dt>
          <dd>
            {data.publicId && data.pdfUrl ? (
              <button type="button" className="btn" disabled={busy} onClick={() => void download()}>
                {busy ? "Downloading…" : "Download agreement PDF"}
              </button>
            ) : (
              "n/a"
            )}
          </dd>
        </div>
      </dl>
    </article>
  );
}
