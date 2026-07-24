import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminFetch } from "../../lib/adminApi";
import { useAdminPath } from "../../lib/adminPath";

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
  const { path: adminPath } = useAdminPath();
  const ADMIN_BASE = adminPath ?? "";
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Dash>("/api/ops/dashboard")
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
          <Link className="btn primary" to={`/${ADMIN_BASE}/agreements/new`}>
            New agreement + 3 proofs
          </Link>
          <Link className="btn" to={`/${ADMIN_BASE}/certificates/new`}>
            New cert + evidence
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <article>
          <h3>Visits today</h3>
          <p className="stat">{data.visitsToday ?? 0}</p>
          <Link className="muted" to={`/${ADMIN_BASE}/visits`}>
            Open visitors →
          </Link>
        </article>
        <article>
          <h3>Unread messages</h3>
          <p className="stat">{data.unreadMessages}</p>
          <Link className="muted" to={`/${ADMIN_BASE}/messages`}>
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
