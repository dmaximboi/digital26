import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminApi";

type Item = {
  id: string;
  adminEmail: string;
  action: string;
  targetId: string | null;
  createdAt: string;
};

export function AdminAuditLogPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ items: Item[] }>("/api/ops/audit")
      .then((d) => setItems(d.items))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
  }, []);

  return (
    <div>
      {error && <p className="status error">{error}</p>}
      <div className="table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.adminEmail}</td>
                <td>{row.action}</td>
                <td>{row.targetId ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
