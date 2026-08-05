import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/authApi";

type Dash = {
  agreementsThisMonth: number;
  certsIssued: number;
  expiredUnusedLinks: number;
  pendingLinks: number;
  peopleCount: number;
  unreadMessages: number;
  visitsToday?: number;
  visitsTotal?: number;
};

export function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Dash>("/api/ops/dashboard")
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      );
  }, []);

  if (error) return <p className="status error">{error}</p>;
  if (!data) return <p>Loading dashboard…</p>;

  return (
    <div className="ops-page">
      <div className="ops-page__head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Overview of letters, certs, and inbox</p>
        </div>
        <div className="ops-page__actions">
          <Link className="btn primary" to={`/admin/agreements/new`}>
            New agreement + 3 proofs
          </Link>
          <Link className="btn" to={`/admin/certificates/new`}>
            New cert + evidence
          </Link>
          <Link className="btn" to={`/admin/library`}>
            Course library
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <article>
          <h3>Visits today</h3>
          <p className="stat">{data.visitsToday ?? 0}</p>
          <Link className="muted" to={`/admin/visits`}>
            Open visitors →
          </Link>
        </article>
        <article>
          <h3>Unread messages</h3>
          <p className="stat">{data.unreadMessages}</p>
          <Link className="muted" to={`/admin/messages`}>
            Open inbox →
          </Link>
        </article>
        <article>
          <h3>Agreements this month</h3>
          <p className="stat">{data.agreementsThisMonth}</p>
        </article>
        <article>
          <h3>Valid certificates</h3>
          <p className="stat">{data.certsIssued}</p>
        </article>
        <article>
          <h3>Pending links</h3>
          <p className="stat">{data.pendingLinks}</p>
        </article>
        <article>
          <h3>Expired unused</h3>
          <p className="stat">{data.expiredUnusedLinks}</p>
        </article>
        <article>
          <h3>Clients</h3>
          <p className="stat">{data.peopleCount}</p>
        </article>
      </div>
    </div>
  );
}
