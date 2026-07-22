import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminDownloadPdf, adminFetch } from "../../lib/adminApi";
import { useAdminPath } from "../../lib/adminPath";

type Item = {
  id: string;
  publicId: string | null;
  dealType: string;
  dealTag?: string | null;
  signedAt: string | null;
  consumedAt: string | null;
  linkExpiresAt: string;
  pdfUrl: string | null;
  person: { id: string; name: string };
  hasPublicCard: boolean;
};

export function AdminAgreementsPage() {
  const { path: adminPath } = useAdminPath();
  const ADMIN_BASE = adminPath ?? "";
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    adminFetch<{ items: Item[] }>(`/api/admin/agreements${params}`)
      .then((d) => setItems(d.items))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
  }, [q]);

  async function download(publicId: string) {
    setBusyId(publicId);
    setError(null);
    try {
      await adminDownloadPdf("agreements", publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="lookup-row" style={{ marginBottom: "1rem" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, public ID…"
        />
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Deal</th>
              <th>Public ID</th>
              <th>Status</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/${ADMIN_BASE}/agreements/${a.id}`}>{a.person.name}</Link>
                </td>
                <td>{a.dealTag || a.dealType}</td>
                <td>{a.publicId ?? "n/a"}</td>
                <td>{a.consumedAt ? "signed" : "open"}</td>
                <td>
                  {a.publicId && a.pdfUrl ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === a.publicId}
                      onClick={() => void download(a.publicId!)}
                    >
                      {busyId === a.publicId ? "…" : "Download"}
                    </button>
                  ) : (
                    "n/a"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
