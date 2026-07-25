import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/authApi";
import { setPageMeta } from "../lib/seo";

type AttendanceData = {
  records: Array<{ weekNumber: number; signedAt: string }>;
  totalWeeks: number;
  currentWeek: number;
  startDate: string | null;
};

export function StudentAttendancePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AttendanceData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPageMeta({ title: "Attendance — The Digital 26", description: "Weekly attendance tracker." });
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    apiFetch<AttendanceData>("/api/student/attendance")
      .then(setData)
      .catch(() => {});
  }, [user]);

  async function signAttendance() {
    setBusy(true);
    setMsg("");
    try {
      const res = await apiFetch<{ ok: boolean; alreadySigned: boolean; weekNumber: number }>("/api/student/attendance", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
      if (res.alreadySigned) {
        setMsg(`You already signed for Week ${res.weekNumber} this week.`);
      } else {
        setMsg(`Attendance signed for Week ${res.weekNumber}!`);
      }
      const updated = await apiFetch<AttendanceData>("/api/student/attendance");
      setData(updated);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to sign attendance");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return <section className="panel" aria-busy="true"><p className="muted">Loading...</p></section>;
  }

  const signedWeeks = new Set(data.records.map((r) => r.weekNumber));

  return (
    <section className="panel attendance-page">
      <Link to="/dashboard" className="back-link">&larr; Dashboard</Link>
      <h1>Weekly Attendance</h1>

      {data.startDate && (
        <p className="muted">Programme started: {new Date(data.startDate).toLocaleDateString()}</p>
      )}

      <p>
        Progress: <strong>{data.records.length}</strong> / {data.totalWeeks} weeks signed
        {data.currentWeek > 0 && <> &middot; Current week: <strong>{data.currentWeek}</strong></>}
      </p>

      {msg && <p className={msg.includes("!") ? "form-success" : "form-error"} role="alert">{msg}</p>}

      <button type="button" className="btn primary" onClick={signAttendance} disabled={busy}>
        {busy ? "Signing..." : "Sign This Week's Attendance"}
      </button>

      <div className="attendance-grid">
        {Array.from({ length: data.totalWeeks }, (_, i) => {
          const week = i + 1;
          const signed = signedWeeks.has(week);
          const isCurrent = week === data.currentWeek;
          const isPast = week < data.currentWeek;
          const cls = signed ? "signed" : isPast ? "missed" : isCurrent ? "current" : "future";
          return (
            <div key={week} className={`attendance-cell ${cls}`} title={`Week ${week}`}>
              <span className="attendance-cell__num">{week}</span>
              {signed && <span className="attendance-cell__check">&#10003;</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
