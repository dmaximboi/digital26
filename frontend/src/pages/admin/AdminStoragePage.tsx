import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../lib/authApi";

type StorageStats = {
  database: Record<string, number>;
  cache: { size: number; maxEntries: number };
  imagekit: {
    enabled: boolean;
    files: number;
    bytes: number;
    bytesMb: number;
    folders: string[];
  };
};

export function AdminStoragePage() {
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteUrl, setDeleteUrl] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<StorageStats>("/api/ops/storage/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function maintain() {
    setBusy("maintain");
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<{
        ok: boolean;
        expiredOtps: number;
        oldVisits: number;
        note: string;
      }>("/api/ops/storage/maintain", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
      setMessage(
        `Maintenance done. Removed ${res.expiredOtps} OTPs and ${res.oldVisits} old visits. ${res.note}`,
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Maintenance failed");
    } finally {
      setBusy("");
    }
  }

  async function wipe() {
    if (confirmText !== "WIPE") {
      setError('Type WIPE in the box to confirm full cleanup');
      return;
    }
    if (!confirm("This deletes certificates, agreements, students, images, and chats. Admin accounts stay. Continue?")) {
      return;
    }
    setBusy("wipe");
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<{
        ok: boolean;
        message: string;
        imagekitDeleted: number;
        imagekitFolderPurge: { deleted: number; errors: number };
        localFoldersRemoved: number;
        deleted: Record<string, number>;
      }>("/api/ops/storage/wipe", {
        method: "POST",
        body: JSON.stringify({ confirm: "WIPE" }),
        headers: { "Content-Type": "application/json" },
      });
      setMessage(
        `${res.message} ImageKit deleted: ${res.imagekitDeleted + res.imagekitFolderPurge.deleted}. Local folders: ${res.localFoldersRemoved}.`,
      );
      setConfirmText("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wipe failed");
    } finally {
      setBusy("");
    }
  }

  async function deleteOne() {
    if (!deleteUrl.trim()) return;
    setBusy("delete");
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<{ ok: boolean }>("/api/ops/storage/imagekit/delete", {
        method: "POST",
        body: JSON.stringify({ url: deleteUrl.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setMessage(res.ok ? "ImageKit file deleted." : "File not found on ImageKit (or already gone).");
      setDeleteUrl("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="ops-page-head">
        <div>
          <h2 className="ops-page-title">Storage</h2>
          <p className="muted">
            Clean database content and ImageKit files. Admin allowlist and admin accounts are never deleted.
            Maintenance reduces DB egress by clearing old OTPs, old visits, and cache.
          </p>
        </div>
        <button className="btn" type="button" onClick={load} disabled={loading || Boolean(busy)}>
          Refresh
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}
      {loading && <p className="muted">Loading storage stats...</p>}

      {stats && (
        <div className="storage-grid">
          <article className="storage-card">
            <h3>Database</h3>
            <ul>
              {Object.entries(stats.database).map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </li>
              ))}
            </ul>
          </article>
          <article className="storage-card">
            <h3>ImageKit</h3>
            <p>{stats.imagekit.enabled ? "Connected" : "Not configured"}</p>
            <ul>
              <li>
                <span>files</span>
                <strong>{stats.imagekit.files}</strong>
              </li>
              <li>
                <span>size</span>
                <strong>{stats.imagekit.bytesMb} MB</strong>
              </li>
            </ul>
            <p className="muted">{stats.imagekit.folders.join(", ")}</p>
          </article>
          <article className="storage-card">
            <h3>Memory cache</h3>
            <ul>
              <li>
                <span>entries</span>
                <strong>
                  {stats.cache.size} / {stats.cache.maxEntries}
                </strong>
              </li>
            </ul>
            <p className="muted">Cuts repeated public cert/agreement DB reads (egress).</p>
          </article>
        </div>
      )}

      {canWrite ? (
        <>
          <section className="storage-actions">
            <h3>Maintenance (safe)</h3>
            <p className="muted">
              Deletes expired OTP codes and site visits older than 30 days, then clears in-memory cache.
              This lowers Neon egress without removing real student or cert data.
            </p>
            <button className="btn primary" type="button" disabled={Boolean(busy)} onClick={() => void maintain()}>
              {busy === "maintain" ? "Running..." : "Run maintenance"}
            </button>
          </section>

          <section className="storage-actions">
            <h3>Delete one ImageKit image</h3>
            <div className="student-msg-input">
              <input
                className="form-input"
                value={deleteUrl}
                onChange={(e) => setDeleteUrl(e.target.value)}
                placeholder="https://ik.imagekit.io/..."
                disabled={Boolean(busy)}
              />
              <button className="btn" type="button" disabled={Boolean(busy) || !deleteUrl.trim()} onClick={() => void deleteOne()}>
                {busy === "delete" ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>

          <section className="storage-actions danger-zone">
            <h3>Full wipe (except admin)</h3>
            <p className="muted">
              Removes certificates, agreements, people, students, chats, contact messages, visits, OTPs,
              audit logs, local uploads, and ImageKit media. Keeps admin allowlist and admin/readonly users.
            </p>
            <label className="form-label">
              Type WIPE to confirm
              <input
                className="form-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={Boolean(busy)}
                placeholder="WIPE"
              />
            </label>
            <button
              className="btn danger"
              type="button"
              disabled={Boolean(busy) || confirmText !== "WIPE"}
              onClick={() => void wipe()}
            >
              {busy === "wipe" ? "Wiping..." : "Wipe all content"}
            </button>
          </section>
        </>
      ) : (
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          Read-only access — storage cleanup actions are hidden.
        </p>
      )}
    </div>
  );
}
