import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiDownload, apiFetch } from "../../lib/authApi";
import { EvidenceGallery } from "../../components/EvidenceGallery";

type EvidenceItem = {
  id: string;
  kind: string;
  url: string;
  phoneHint?: string | null;
  uploadedBy: string;
};

type Item = {
  id: string;
  publicId: string | null;
  type: string;
  course: string;
  issueDate: string;
  status: string;
  pdfUrl: string | null;
  canDownloadPdf?: boolean;
  evidenceCount?: number;
  evidence?: EvidenceItem[];
  person: { id: string; name: string } | null;
};

export function AdminCertificatesPage() {
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<{ items: Item[] }>("/api/ops/certificates");
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Failed"),
    );
  }, []);

  async function revoke(publicId: string) {
    setBusyId(`revoke:${publicId}`);
    try {
      await apiFetch(`/api/ops/certificates/${encodeURIComponent(publicId)}/revoke`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusyId(null);
    }
  }

  async function download(publicId: string) {
    setBusyId(`pdf:${publicId}`);
    setError(null);
    try {
      await apiDownload(`/api/ops/files/certificates/${publicId}.pdf`, `${publicId}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadPng(publicId: string) {
    setBusyId(`png:${publicId}`);
    setError(null);
    try {
      await apiDownload(`/api/ops/certificates/${publicId}/png`, `${publicId}-4k.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PNG download failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="ops-page-head">
        <div>
          <h2 className="ops-page-title">Certificates</h2>
          <p className="muted">
            Issue certificates to approved students. Their name, photo, and programme are used
            automatically.
          </p>
        </div>
        {canWrite && (
          <Link className="btn primary" to={`/admin/certificates/new`}>
            Issue Certificate
          </Link>
        )}
      </div>

      {error && <p className="status error">{error}</p>}
      <div className="table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Type</th>
              <th>Public ID</th>
              <th>Evidence</th>
              <th>Status</th>
              <th>Download</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td>
                    {c.person?.name ?? (
                      <span className="muted">Unknown</span>
                    )}
                  </td>
                  <td>{c.type}</td>
                  <td>
                    {c.publicId ? (
                      <a href={`/verify/${c.publicId}`}>{c.publicId}</a>
                    ) : (
                      "n/a"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      disabled={!c.evidenceCount}
                      onClick={() =>
                        setOpenEvidenceId((id) => (id === c.id ? null : c.id))
                      }
                    >
                      {c.evidenceCount ?? 0} photos
                    </button>
                  </td>
                  <td>{c.status}</td>
                  <td>
                    {(c.canDownloadPdf || (c.publicId && c.status === "VALID")) ? (
                      <div className="ops-download-row">
                        <button
                          type="button"
                          className="btn"
                          disabled={busyId === `pdf:${c.publicId}`}
                          onClick={() => void download(c.publicId!)}
                        >
                          {busyId === `pdf:${c.publicId}` ? "..." : "PDF"}
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={busyId === `png:${c.publicId}`}
                          onClick={() => void downloadPng(c.publicId!)}
                        >
                          {busyId === `png:${c.publicId}` ? "..." : "4K PNG"}
                        </button>
                      </div>
                    ) : (
                      "n/a"
                    )}
                  </td>
                  <td>
                    {canWrite && c.status === "VALID" && c.publicId && (
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === `revoke:${c.publicId}`}
                        onClick={() => void revoke(c.publicId!)}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
                {openEvidenceId === c.id && (
                  <tr>
                    <td colSpan={7}>
                      <EvidenceGallery
                        items={c.evidence ?? []}
                        emptyHint="No evidence uploaded for this certificate yet."
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
