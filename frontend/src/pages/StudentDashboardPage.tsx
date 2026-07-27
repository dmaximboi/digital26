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
  programme: "FIVE_MONTH" | "SIX_MONTH" | "CUSTOM";
  customMonths: number | null;
  classMode: "PHYSICAL" | "ONLINE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionNote: string | null;
  startDate: string | null;
};

type StudentMsg = {
  id: string;
  fromAdmin: boolean;
  body: string;
  createdAt: string;
};

export function StudentDashboardPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [messages, setMessages] = useState<StudentMsg[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);

  useEffect(() => {
    setPageMeta({ title: "Dashboard The Digital 26", description: "Your student dashboard." });
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

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
    apiFetch<{ profile: Profile | null }>("/api/student/me")
      .then((d) => setProfile(d.profile))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, navigate]);

  useEffect(() => {
    if (!profile) return;
    apiFetch<{ messages: StudentMsg[] }>("/api/student/messages")
      .then((d) => setMessages(d.messages))
      .catch(() => {});
  }, [profile]);

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

  function programmeName(p: Profile) {
    if (p.programme === "CUSTOM" && p.customMonths) return `${p.customMonths}-Month Custom`;
    return p.programme === "FIVE_MONTH" ? "5-Month Accelerated" : "6-Month Standard";
  }

  if (loading || fetching) {
    return <section className="panel" aria-busy="true"><p className="muted">Loading...</p></section>;
  }
  if (!profile) {
    return <section className="panel"><p>No profile found.</p></section>;
  }

  if (profile.status === "PENDING") {
    return (
      <section className="panel dashboard-status pending">
        <div className="status-icon">&#9203;</div>
        <h1>Account Pending Review</h1>
        <p className="lede">
          Your application has been submitted and is under admin review.
          You'll be able to access the class once approved.
        </p>
        <div className="status-details">
          <p><strong>Name:</strong> {profile.fullName}</p>
          <p><strong>Programme:</strong> {programmeName(profile)}</p>
          <p><strong>Class:</strong> {profile.classMode === "ONLINE" ? "Online" : "Physical"}</p>
        </div>

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

        <button className="btn" onClick={signOut} style={{ marginTop: "1rem" }}>Sign out</button>
      </section>
    );
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

        <p className="muted">If you believe this is an error, please <Link to="/contact">contact us</Link>.</p>
        <button className="btn" onClick={signOut} style={{ marginTop: "1rem" }}>Sign out</button>
      </section>
    );
  }

  return (
    <section className="panel dashboard-approved">
      <h1>Welcome, {profile.fullName}!</h1>
      <p className="lede">
        Your account has been approved. You are enrolled in the{" "}
        <strong>{programmeName(profile)}</strong> programme ({profile.classMode === "ONLINE" ? "Online" : "Physical"}).
      </p>

      {profile.startDate && (
        <p className="muted">Started: {new Date(profile.startDate).toLocaleDateString()}</p>
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
