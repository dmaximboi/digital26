import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/authApi";
import { setPageMeta } from "../lib/seo";

type LibItem = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string;
  isFree: boolean;
  priceUsd: string | null;
  unlocked: boolean;
};

export function StudentLibraryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<LibItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setPageMeta({
      title: "Course library The Digital 26",
      description: "View course resources shared by Digital 26.",
    });
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const data = await apiFetch<{ items: LibItem[] }>("/api/student/library");
    setItems(data.items);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN" || user.role === "READONLY") {
      navigate("/admin/library", { replace: true });
      return;
    }
    if (!user.hasProfile) {
      navigate("/apply", { replace: true });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("checkout_id");

    (async () => {
      setFetching(true);
      setError("");
      try {
        if (checkoutId) {
          await apiFetch("/api/public/payments/sync?checkout_id=" + encodeURIComponent(checkoutId));
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout_id");
          window.history.replaceState({}, "", url.pathname);
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load library");
      } finally {
        setFetching(false);
      }
    })();
  }, [user, navigate, load]);

  async function openItem(item: LibItem) {
    if (busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      if (!item.unlocked) {
        const checkout = await apiFetch<{
          checkoutUrl?: string;
          alreadyPaid?: boolean;
          free?: boolean;
        }>(`/api/student/library/${item.id}/checkout`, {
          method: "POST",
          body: "{}",
        });
        if (checkout.checkoutUrl) {
          window.location.href = checkout.checkoutUrl;
          return;
        }
        await load();
      }

      const opened = await apiFetch<{ viewUrl: string; downloadable: boolean }>(
        `/api/student/library/${item.id}/open`,
        { method: "POST", body: "{}" },
      );
      if (!opened.viewUrl) throw new Error("No view link returned");
      // External viewer only — never force a download from our app.
      window.open(opened.viewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open resource");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || fetching) {
    return (
      <section className="panel library-page" aria-busy="true">
        <p className="muted">Loading library…</p>
      </section>
    );
  }

  return (
    <section className="panel library-page">
      <Link to="/dashboard" className="back-link">
        &larr; Dashboard
      </Link>
      <h1>Course library</h1>
      <p className="lede">
        Resources open in a secure viewer tab. Files are never downloadable from Digital 26.
      </p>

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 && <p className="muted">No library items yet. Check back soon.</p>}

      <div className="library-grid">
        {items.map((item) => (
          <article key={item.id} className="library-card">
            <div className="library-card__cover">
              <img
                src={item.coverUrl}
                alt=""
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
              <span className={`library-card__badge ${item.unlocked ? "ok" : "lock"}`}>
                {item.isFree ? "Free" : item.unlocked ? "Unlocked" : `$${item.priceUsd}`}
              </span>
            </div>
            <div className="library-card__body">
              <h2>{item.title}</h2>
              {item.description && <p className="muted">{item.description}</p>}
              <button
                type="button"
                className="btn primary"
                disabled={busyId === item.id}
                onClick={() => void openItem(item)}
              >
                {busyId === item.id
                  ? "Working…"
                  : item.unlocked
                    ? "Open (view only)"
                    : `Unlock $${item.priceUsd}`}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
