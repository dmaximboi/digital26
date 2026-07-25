import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/authApi";

type StudentItem = {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  photoUrl: string | null;
  parentPhone: string | null;
  address: string | null;
  programme: "FIVE_MONTH" | "SIX_MONTH";
  status: "PENDING" | "APPROVED" | "REJECTED";
  startDate: string | null;
  attendanceCount: number;
  createdAt: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
};

export function AdminStudentsPage() {
  const [items, setItems] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ items: StudentItem[] }>("/api/ops/students")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function approve(id: string) {
    setBusy(id);
    try {
      await apiFetch("/api/ops/students/" + id + "/approve", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    const note = prompt("Rejection reason (optional):");
    setBusy(id);
    try {
      await apiFetch("/api/ops/students/" + id + "/reject", {
        method: "POST",
        body: JSON.stringify({ note: note || "" }),
        headers: { "Content-Type": "application/json" },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const pending = items.filter((s) => s.status === "PENDING");
  const approved = items.filter((s) => s.status === "APPROVED");
  const rejected = items.filter((s) => s.status === "REJECTED");

  return (
    <div>
      <div className="ops-page-head">
        <h2 className="ops-page-title">Students</h2>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="muted">Loading...</p>}

      {pending.length > 0 && (
        <>
          <h3 className="ops-section-title">Pending Review ({pending.length})</h3>
          <div className="student-cards">
            {pending.map((s) => (
              <div key={s.id} className="student-card pending">
                <div className="student-card__photo">
                  {s.photoUrl ? <img src={s.photoUrl} alt={s.fullName} /> : <div className="no-photo" />}
                </div>
                <div className="student-card__info">
                  <h4>{s.fullName}</h4>
                  <p className="muted">{s.user.email}</p>
                  <p>Phone: {s.phone}</p>
                  {s.parentPhone && <p>Parent: {s.parentPhone}</p>}
                  {s.address && <p>Address: {s.address}</p>}
                  <p className="programme-badge">
                    {s.programme === "FIVE_MONTH" ? "5-Month Accelerated" : "6-Month Standard"}
                  </p>
                  <p className="muted">Applied: {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="student-card__actions">
                  <button className="btn primary" onClick={() => approve(s.id)} disabled={busy === s.id}>
                    Approve
                  </button>
                  <button className="btn danger" onClick={() => reject(s.id)} disabled={busy === s.id}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {approved.length > 0 && (
        <>
          <h3 className="ops-section-title">Approved ({approved.length})</h3>
          <table className="ops-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Programme</th>
                <th>Attendance</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>{s.user.email}</td>
                  <td>{s.programme === "FIVE_MONTH" ? "5M" : "6M"}</td>
                  <td>{s.attendanceCount} / {s.programme === "FIVE_MONTH" ? 22 : 26}</td>
                  <td>{s.startDate ? new Date(s.startDate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {rejected.length > 0 && (
        <>
          <h3 className="ops-section-title">Rejected ({rejected.length})</h3>
          <table className="ops-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Programme</th></tr>
            </thead>
            <tbody>
              {rejected.map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>{s.user.email}</td>
                  <td>{s.programme === "FIVE_MONTH" ? "5M" : "6M"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
