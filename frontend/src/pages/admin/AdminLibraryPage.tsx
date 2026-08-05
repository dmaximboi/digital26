import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch, apiPatchForm, apiPostForm } from "../../lib/authApi";

type LibraryItem = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string;
  externalUrl: string;
  isFree: boolean;
  priceUsd: string | null;
  published: boolean;
  sortOrder: number;
};

const emptyForm = {
  title: "",
  description: "",
  externalUrl: "",
  isFree: true,
  priceUsd: "1.00",
  published: true,
  sortOrder: "0",
};

export function AdminLibraryPage() {
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [cover, setCover] = useState<File | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ items: LibraryItem[] }>("/api/ops/library")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function startEdit(item: LibraryItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description || "",
      externalUrl: item.externalUrl,
      isFree: item.isFree,
      priceUsd: item.priceUsd || "1.00",
      published: item.published,
      sortOrder: String(item.sortOrder),
    });
    setCover(null);
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setCover(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("title", form.title.trim());
      body.append("description", form.description.trim());
      body.append("externalUrl", form.externalUrl.trim());
      body.append("isFree", String(form.isFree));
      body.append("priceUsd", form.priceUsd);
      body.append("published", String(form.published));
      body.append("sortOrder", form.sortOrder);
      if (cover) body.append("cover", cover);

      if (editingId) {
        await apiPatchForm(`/api/ops/library/${editingId}`, body);
      } else {
        if (!cover) throw new Error("Cover image is required for new items");
        await apiPostForm("/api/ops/library", body);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!canWrite || !confirm("Delete this library item?")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/ops/library/${id}`, { method: "DELETE", body: "{}" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="ops-page-head">
        <h2 className="ops-page-title">Course library</h2>
        <p className="muted">
          Share Drive/folder links with a cover image. Resources open in-browser only — nothing is
          downloadable from this site.
        </p>
        {!canWrite && <p className="muted">Read-only access.</p>}
      </div>

      {error && <p className="form-error">{error}</p>}

      {canWrite && (
        <form className="library-admin-form" onSubmit={(e) => void onSubmit(e)}>
          <h3>{editingId ? "Edit item" : "Add item"}</h3>
          <label>
            Title
            <input
              className="form-input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              maxLength={160}
            />
          </label>
          <label>
            Description
            <textarea
              className="form-input form-textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </label>
          <label>
            Resource link (https Google Drive / Docs)
            <input
              className="form-input"
              type="url"
              value={form.externalUrl}
              onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
              required
              placeholder="https://drive.google.com/..."
            />
          </label>
          <label>
            Cover image {editingId ? "(optional to replace)" : "*"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              required={!editingId}
            />
          </label>
          <div className="library-admin-form__row">
            <label className="library-check">
              <input
                type="checkbox"
                checked={form.isFree}
                onChange={(e) => setForm((f) => ({ ...f, isFree: e.target.checked }))}
              />
              Free
            </label>
            {!form.isFree && (
              <label>
                Price (USD)
                <input
                  className="form-input"
                  value={form.priceUsd}
                  onChange={(e) => setForm((f) => ({ ...f, priceUsd: e.target.value }))}
                  required
                />
              </label>
            )}
            <label className="library-check">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              />
              Published
            </label>
            <label>
              Sort
              <input
                className="form-input"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </label>
          </div>
          <div className="library-admin-form__actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Update" : "Add to library"}
            </button>
            {editingId && (
              <button className="btn" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}

      {loading && <p className="muted">Loading…</p>}

      <div className="library-admin-grid">
        {items.map((item) => (
          <article key={item.id} className="library-admin-card">
            <img
              src={item.coverUrl}
              alt=""
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div>
              <h4>{item.title}</h4>
              <p className="muted">
                {item.isFree ? "Free" : `$${item.priceUsd}`} ·{" "}
                {item.published ? "Published" : "Hidden"}
              </p>
              <p className="library-admin-card__link muted">{item.externalUrl}</p>
              {canWrite && (
                <div className="library-admin-card__actions">
                  <button className="btn" type="button" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button className="btn danger" type="button" onClick={() => void remove(item.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
