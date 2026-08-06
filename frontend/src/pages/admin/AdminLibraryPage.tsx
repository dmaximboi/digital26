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
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<{ items: LibraryItem[] }>("/api/ops/library")
      .then((d) => {
        setItems(d.items || []);
        setError("");
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load";
        // Empty catalog is fine — only surface real failures.
        if (/not found/i.test(msg)) {
          setItems([]);
          setError("Library is still setting up. Refresh in a moment.");
        } else {
          setError(msg);
        }
      })
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
    setCoverPreview(item.coverUrl);
    setShowForm(true);
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setCover(null);
    setCoverPreview(null);
    setShowForm(false);
  }

  function pickCover(file: File | null) {
    setCover(file);
    if (!file) {
      setCoverPreview(editingId ? coverPreview : null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
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
        if (!cover) throw new Error("Add a cover image");
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
    if (!canWrite || !confirm("Remove this item from the library?")) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/ops/library/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ops-page library-ops">
      <div className="ops-page__head">
        <div>
          <h2>Library</h2>
          <p className="muted">Course materials for students</p>
        </div>
        {canWrite && (
          <div className="ops-page__actions">
            {!showForm ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setCover(null);
                  setCoverPreview(null);
                  setShowForm(true);
                }}
              >
                Add material
              </button>
            ) : (
              <button type="button" className="btn" onClick={resetForm}>
                Close form
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      {canWrite && showForm && (
        <form className="library-ops__form sign-form" onSubmit={(e) => void onSubmit(e)}>
          <h3>{editingId ? "Edit material" : "New material"}</h3>

          <div className="library-ops__form-grid">
            <div className="library-ops__fields">
              <label>
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  maxLength={160}
                  placeholder="e.g. Week 1 — Intro to Digital Marketing"
                />
              </label>

              <label>
                Short description
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="What students will find inside"
                />
              </label>

              <label>
                Material link
                <input
                  type="url"
                  value={form.externalUrl}
                  onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
                  required
                  placeholder="https://…"
                />
              </label>

              <div className="library-ops__meta">
                <label className="library-ops__check">
                  <input
                    type="checkbox"
                    checked={form.isFree}
                    onChange={(e) => setForm((f) => ({ ...f, isFree: e.target.checked }))}
                  />
                  Free access
                </label>

                {!form.isFree && (
                  <label>
                    Price (USD)
                    <input
                      value={form.priceUsd}
                      onChange={(e) => setForm((f) => ({ ...f, priceUsd: e.target.value }))}
                      required
                      inputMode="decimal"
                    />
                  </label>
                )}

                <label className="library-ops__check">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                  />
                  Visible to students
                </label>

                <label>
                  Order
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="library-ops__cover">
              <label>
                Cover image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
                  required={!editingId}
                />
              </label>
              <div className="library-ops__cover-preview">
                {coverPreview ? (
                  <img src={coverPreview} alt="" />
                ) : (
                  <span className="muted">Preview appears here</span>
                )}
              </div>
            </div>
          </div>

          <div className="library-ops__form-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Save changes" : "Publish"}
            </button>
            <button className="btn" type="button" onClick={resetForm} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="library-ops__empty">
          <p>No materials yet.</p>
          {canWrite && (
            <button
              type="button"
              className="btn primary"
              onClick={() => setShowForm(true)}
            >
              Add the first one
            </button>
          )}
        </div>
      ) : (
        <div className="library-ops__list">
          {items.map((item) => (
            <article key={item.id} className="library-ops__row">
              <img src={item.coverUrl} alt="" className="library-ops__thumb" />
              <div className="library-ops__row-body">
                <div className="library-ops__row-top">
                  <h3>{item.title}</h3>
                  <span className={`library-ops__pill ${item.published ? "on" : "off"}`}>
                    {item.published ? "Live" : "Hidden"}
                  </span>
                  <span className="library-ops__pill price">
                    {item.isFree ? "Free" : `$${item.priceUsd}`}
                  </span>
                </div>
                {item.description && <p className="muted">{item.description}</p>}
                <p className="library-ops__url muted">{item.externalUrl}</p>
                {canWrite && (
                  <div className="library-ops__row-actions">
                    <button type="button" className="btn" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busy}
                      onClick={() => void remove(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {!canWrite && <p className="muted">Read-only access.</p>}
    </div>
  );
}
