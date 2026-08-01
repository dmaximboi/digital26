import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/authApi";
import { setPageMeta } from "../lib/seo";

type Profile = {
  id: string;
  fullName: string;
  phone: string;
  photoUrl: string | null;
  programme: "THREE_MONTH" | "FOUR_MONTH" | "FIVE_MONTH" | "SIX_MONTH" | "CUSTOM";
  customMonths: number | null;
  classMode: "PHYSICAL" | "ONLINE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionNote: string | null;
  startDate: string | null;
  registrationPaidAt?: string | null;
  registrationPaid?: boolean;
};

type StudentMsg = {
  id: string;
  fromAdmin: boolean;
  body: string;
  createdAt: string;
};

type Progress = {
  records: Array<{ weekNumber: number; signedAt: string }>;
  totalWeeks: number;
  currentWeek: number;
  startDate: string | null;
};

export function StudentDashboardPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [messages, setMessages] = useState<StudentMsg[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    setPageMeta({ title: "Dashboard The Digital 26", description: "Your student dashboard." });
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  async function refreshProfile() {
    const d = await apiFetch<{ profile: Profile | null }>("/api/student/me");
    setProfile(d.profile);
    return d.profile;
  }

  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN" || user.role === "READONLY") {
      navigate("/admin", { replace: true });
      return;
    }
    if (!user.hasProfile) {
      navigate("/apply", { replace: true });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("checkout_id");
    const paid = params.get("paid");

    (async () => {
      try {
        if (checkoutId) {
          await fetch(
            `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api/public/payments/sync?checkout_id=${encodeURIComponent(checkoutId)}`,
          );
        } else if (paid === "1") {
          await new Promise((r) => setTimeout(r, 1000));
        }
        await refreshProfile();
      } catch {
        /* ignore */
      } finally {
        setFetching(false);
        if (checkoutId || paid || params.get("cancelled")) {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout_id");
          url.searchParams.delete("paid");
          url.searchParams.delete("cancelled");
          window.history.replaceState({}, "", url.pathname);
        }
      }
    })();
  }, [user, navigate]);

  useEffect(() => {
    if (!profile) return;
    apiFetch<{ messages: StudentMsg[] }>("/api/student/messages")
      .then((d) => setMessages(d.messages))
      .catch(() => {});
  }, [profile]);

  const registrationPaid = Boolean(profile?.registrationPaid || profile?.registrationPaidAt);
  const fullyActive = profile?.status === "APPROVED" && registrationPaid;

  useEffect(() => {
    if (!profile || !fullyActive) return;
    apiFetch<Progress>("/api/student/attendance")
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [profile, fullyActive]);

  async function sendMessage() {
    if (!msgBody.trim() || msgBusy) return;
    setMsgBusy(true);
    try {
      await apiFetch("/api/student/messages", {
        method: "POST",
        body: JSON.stringify({ body: msgBody.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setMsgBody("");
      const d = await apiFetch<{ messages: StudentMsg[] }>("/api/student/messages");
      setMessages(d.messages);
    } catch {} finally {
      setMsgBusy(false);
    }
  }

  async function payRegistration() {
    if (payBusy) return;
    setPayError("");
    setPayBusy(true);
    try {
      const data = await apiFetch<{
        checkoutUrl?: string;
        alreadyPaid?: boolean;
      }>("/api/student/payments/registration", { method: "POST", body: "{}" });
      if (data.alreadyPaid) {
        await refreshProfile();
        return;
      }
      if (!data.checkoutUrl) throw new Error("No checkout URL returned");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed to start");
      setPayBusy(false);
    }
  }

  function programmeName(p: Profile) {
    if (p.programme === "THREE_MONTH") return "3-Month Intensive";
    if (p.programme === "FOUR_MONTH") return "4-Month Advanced";
    if (p.programme === "CUSTOM" && p.customMonths) return `${p.customMonths}-Month Custom`;
    return p.programme === "FIVE_MONTH" ? "5-Month Accelerated" : "6-Month Standard";
  }

  function MessagesBlock() {
    return (
      <div className="student-msg-box">
        <h3>Messages</h3>
        <div className="student-msg-list">
          {messages.length === 0 && <p className="muted">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`student-msg ${m.fromAdmin ? "from-admin" : "from-student"}`}>
              <span className="student-msg__label">{m.fromAdmin ? "Admin" : "You"}</span>
              <p className="student-msg__body">{m.body}</p>
              <time className="student-msg__time">{new Date(m.createdAt).toLocaleString()}</time>
            </div>
          ))}
        </div>
        <div className="student-msg-input">
          <input
            type="text"
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            placeholder="Send a message to admin..."
            maxLength={500}
            disabled={msgBusy}
            className="form-input"
            onKeyDown={(e) => { if (e.key === "Enter") void sendMessage(); }}
          />
          <button className="btn primary" onClick={() => void sendMessage()} disabled={!msgBody.trim() || msgBusy}>
            Send
          </button>
        </div>
      </div>
    );
  }

  if (loading || fetching) {
    return <section className="panel" aria-busy="true"><p className="muted">Loading...</p></section>;
  }
  if (!profile) {
    return <section className="panel"><p>No profile found.</p></section>;
  }

  if (profile.status === "REJECTED") {
    return (
      <section className="panel dashboard-status rejected">
        <div className="status-icon">&#128546;</div>
        <h1>Application Not Approved</h1>
        <p className="lede">
          Unfortunately, your application was not approved at this time.
        </p>
        {profile.rejectionNote && (
          <div className="rejection-note">
            <p><strong>Note from admin:</strong> {profile.rejectionNote}</p>
          </div>
        )}
        <MessagesBlock />
        <p className="muted">If you believe this is an error, please <Link to="/contact">contact us</Link>.</p>
        <button className="btn" onClick={signOut} style={{ marginTop: "1rem" }}>Sign out</button>
      </section>
    );
  }

  if (!fullyActive) {
    const adminDone = profile.status === "APPROVED";
    return (
      <section className="panel dashboard-status pending">
        <div className="status-icon">&#9203;</div>
        <h1>Account Pending</h1>
        <p className="lede">
          Complete both steps below before you can access attendance and class chat.
        </p>

        <ul className="pending-checklist">
          <li className={adminDone ? "done" : ""}>
            <span className="pending-checklist__mark" aria-hidden="true">
              {adminDone ? "✓" : "1"}
            </span>
            <div>
              <strong>Admin review</strong>
              <p className="muted">
                {adminDone
                  ? "Approved — you are cleared by an admin."
                  : "Your application is waiting for admin approval."}
              </p>
            </div>
          </li>
          <li className={registrationPaid ? "done" : ""}>
            <span className="pending-checklist__mark" aria-hidden="true">
              {registrationPaid ? "✓" : "2"}
            </span>
            <div>
              <strong>Registration payment ($3 USD)</strong>
              <p className="muted">
                {registrationPaid
                  ? "Paid — thank you."
                  : "One-time fee. Charged in your local currency at checkout via Bachs."}
              </p>
              {!registrationPaid && (
                <button
                  className="btn primary"
                  type="button"
                  disabled={payBusy}
                  onClick={() => void payRegistration()}
                  style={{ marginTop: "0.75rem" }}
                >
                  {payBusy ? "Redirecting…" : "Pay $3 registration"}
                </button>
              )}
              {payError && (
                <p className="status error" role="alert" style={{ marginTop: "0.5rem" }}>
                  {payError}
                </p>
              )}
            </div>
          </li>
        </ul>

        <div className="status-details">
          <p><strong>Name:</strong> {profile.fullName}</p>
          <p><strong>Programme:</strong> {programmeName(profile)}</p>
          <p><strong>Class:</strong> {profile.classMode === "ONLINE" ? "Online" : "Physical"}</p>
        </div>

        <MessagesBlock />
        <button className="btn" onClick={signOut} style={{ marginTop: "1rem" }}>Sign out</button>
      </section>
    );
  }

  const signed = progress?.records.length ?? 0;
  const totalWeeks = progress?.totalWeeks ?? 0;
  const currentWeek = progress?.currentWeek ?? 0;
  const weeksElapsed = totalWeeks > 0 ? Math.min(Math.max(currentWeek, 0), totalWeeks) : 0;
  const attendancePct =
    weeksElapsed > 0 ? Math.round((signed / weeksElapsed) * 100) : 0;
  const programmePct =
    totalWeeks > 0 ? Math.min(100, Math.round((weeksElapsed / totalWeeks) * 100)) : 0;

  return (
    <section className="panel dashboard-approved">
      <h1>Welcome, {profile.fullName}!</h1>
      <p className="lede">
        Your account is active. You are enrolled in the{" "}
        <strong>{programmeName(profile)}</strong> programme ({profile.classMode === "ONLINE" ? "Online" : "Physical"}).
      </p>

      {profile.startDate && (
        <p className="muted">Started: {new Date(profile.startDate).toLocaleDateString()}</p>
      )}

      {progress && totalWeeks > 0 && (
        <div className="progress-hub" aria-label="Programme progress">
          <div className="progress-hub__stats">
            <div>
              <span className="progress-hub__label">Week</span>
              <strong className="progress-hub__value">
                {Math.min(Math.max(currentWeek, 1), totalWeeks)} / {totalWeeks}
              </strong>
            </div>
            <div>
              <span className="progress-hub__label">Attendance</span>
              <strong className="progress-hub__value">
                {signed} signed · {attendancePct}%
              </strong>
            </div>
          </div>
          <div className="progress-hub__bar" role="progressbar" aria-valuenow={programmePct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${programmePct}%` }} />
          </div>
          <p className="muted progress-hub__hint">
            Programme {programmePct}% through · attendance rate based on weeks so far
          </p>
        </div>
      )}

      <div className="dashboard-cards">
        <Link to="/dashboard/attendance" className="dashboard-card">
          <h3>Attendance</h3>
          <p>Sign your weekly attendance and track progress</p>
        </Link>

        <Link to="/dashboard/chat" className="dashboard-card">
          <h3>Class Chat</h3>
          <p>Chat with fellow students and admin</p>
        </Link>
      </div>

      <button className="btn" onClick={signOut} style={{ marginTop: "1.5rem" }}>Sign out</button>
    </section>
  );
}
