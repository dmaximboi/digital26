import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminApi";

type VisitRow = {
  id: string;
  ip: string;
  path: string;
  referrer: string | null;
  userAgent: string | null;
  createdAt: string;
};

type VisitsPayload = {
  total: number;
  today: number;
  uniqueIpsToday: number;
  items: VisitRow[];
};

export function AdminVisitsPage() {
  const [data, setData] = useState<VisitsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<VisitsPayload>("/api/ops/visits")
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      );
  }, []);

  if (error) return <p className="status error">{error}</p>;
  if (!data) return <p>Loading visits…</p>;

  return (
    <div className="ops-page">
      <div className="ops-page__head">
        <div>
          <h2>Visitors</h2>
          <p className="muted">Page hits by IP and time</p>
        </div>
      </div>

      <div className="stat-grid">
        <article>
          <h3>Total visits</h3>
          <p className="stat">{data.total}</p>
        </article>
        <article>
          <h3>Today</h3>
          <p className="stat">{data.today}</p>
        </article>
        <article>
          <h3>Unique IPs today</h3>
          <p className="stat">{data.uniqueIpsToday}</p>
        </article>
      </div>

      <div className="table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>When</th>
              <th>IP</th>
              <th>Path</th>
              <th>Referrer</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>
                  <code>{row.ip}</code>
                </td>
                <td>{row.path}</td>
                <td className="muted">{row.referrer || "—"}</td>
              </tr>
            ))}
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No visits logged yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
