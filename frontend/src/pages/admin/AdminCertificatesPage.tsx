import { useEffect, useState } from "react";
import { adminDownloadPdf, adminFetch } from "../../lib/adminApi";
import { useAdminPath } from "../../lib/adminPath";

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

type Item = {
  id: string;
  publicId: string | null;
  type: string;
  course: string;
  issueDate: string;
  status: string;
  pdfUrl: string | null;
  claimSessionId: string | null;
  claimExpiresAt: string | null;
  claimedAt: string | null;
  person: { id: string; name: string } | null;
};

export function AdminCertificatesPage() {
  const { path: adminPath } = useAdminPath();
  const ADMIN_BASE = adminPath ?? "";
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const data = await adminFetch<{ items: Item[] }>("/api/admin/certificates");
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
      await adminFetch(`/api/admin/certificates/${encodeURIComponent(publicId)}/revoke`, {
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
      await adminDownloadPdf("certificates", publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <p className="status error">{error}</p>}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Type</th>
              <th>ID / claim</th>
              <th>Status</th>
              <th>PDF</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.person?.name ?? (
                    <span className="muted">Awaiting student claim</span>
                  )}
                </td>
                <td>{c.type}</td>
                <td>
                  {c.publicId ? (
                    <a href={`/verify/${c.publicId}`}>{c.publicId}</a>
                  ) : c.claimSessionId ? (
                    <a href={`${APP_ORIGIN}/claim-cert/${c.claimSessionId}`}>
                      Claim link
                    </a>
                  ) : (
                    "n/a"
                  )}
                  {c.status === "PENDING" && c.claimExpiresAt && (
                    <div className="muted">
                      expires {new Date(c.claimExpiresAt).toLocaleString()}
                    </div>
                  )}
                </td>
                <td>{c.status}</td>
                <td>
                  {c.publicId && c.pdfUrl ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === `pdf:${c.publicId}`}
                      onClick={() => void download(c.publicId!)}
                    >
                      {busyId === `pdf:${c.publicId}` ? "…" : "Download"}
                    </button>
                  ) : (
                    "n/a"
                  )}
                </td>
                <td>
                  {c.status === "VALID" && c.publicId && (
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
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: "0.75rem" }}>
        Types: Participation or Completion ·{" "}
        <a href={`/${ADMIN_BASE}/certificates/new`}>create claim link</a>
      </p>
    </div>
  );
}
