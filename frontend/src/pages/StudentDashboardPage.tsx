import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
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
  const t = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [messages, setMessages] = useState<StudentMsg[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    setPageMeta({ title: t("dash.title"), description: t("dash.title") });
  }, [t]);

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
      .catch(() => setProfile(null))
      .finally(() => setFetching(false));
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

  function programmeName(p: Profile) {
    if (p.programme === "THREE_MONTH") return t("apply.prog.3");
    if (p.programme === "FOUR_MONTH") return t("apply.prog.4");
    if (p.programme === "CUSTOM" && p.customMonths) {
      return `${p.customMonths}-Month ${t("apply.prog.custom")}`;
    }
    return p.programme === "FIVE_MONTH" ? t("apply.prog.5") : t("apply.prog.6");
  }

  function MessagesBlock() {
    return (
      <div className="student-msg-box">
        <h3>{t("dash.messages")}</h3>
        <div className="student-msg-list">
          {messages.length === 0 && <p className="muted">{t("dash.noMessages")}</p>}
          {messages.map((m) => (
            <div key={m.id} className={`student-msg ${m.fromAdmin ? "from-admin" : "from-student"}`}>
              <span className="student-msg__label">{m.fromAdmin ? t("dash.admin") : t("dash.you")}</span>
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
            {t("common.send")}
          </button>
        </div>
      </div>
    );
  }

  if (loading || fetching) {
    return (
      <section className="panel" aria-busy="true">
        <p className="muted">{t("common.loading")}</p>
      </section>
    );
  }
  if (!profile) {
    return <section className="panel"><p>{t("common.error")}</p></section>;
  }

  if (profile.status === "REJECTED") {
    return (
      <section className="panel dashboard-status rejected">
        <div className="status-icon">&#128546;</div>
        <h1>{t("dash.rejected")}</h1>
        <p className="lede">
          Unfortunately, your application was not approved at this time.
        </p>
        {profile.rejectionNote && (
          <div className="rejection-note">
            <p><strong>Note from admin:</strong> {profile.rejectionNote}</p>
          </div>
        )}
        <MessagesBlock />
        <p className="muted">If you believe this is an error, please <Link to="/contact">{t("home.contactUs")}</Link>.</p>
      </section>
    );
  }

  const adminDone = profile.status === "APPROVED";
  const classLabel = profile.classMode === "ONLINE" ? t("apply.online") : t("apply.physical");

  if (!fullyActive) {
    return (
      <section className="panel dashboard-status pending">
        <div className="status-icon">&#9203;</div>
        <h1>{t("dash.pending")}</h1>
        <p className="lede">
          Complete admin approval and registration payment before class access unlocks.
        </p>

        {!registrationPaid ? (
          <Link to="/dashboard/payment" className="payment-banner">
            <div>
              <strong>{t("dash.regDue", { amount: 3 })}</strong>
              <p>{t("dash.payHint")}</p>
            </div>
            <span className="payment-banner__cta">{t("nav.pay")}</span>
          </Link>
        ) : (
          <Link to="/dashboard/payment" className="payment-banner payment-banner--paid">
            <div>
              <strong>{t("dash.regPaid")}</strong>
              <p>
                {adminDone
                  ? "Payment and admin approval complete."
                  : t("pay.waitingAdmin")}
              </p>
            </div>
            <span className="payment-banner__cta">{t("common.open")}</span>
          </Link>
        )}

        <ul className="pending-checklist">
          <li className={adminDone ? "done" : ""}>
            <span className="pending-checklist__mark" aria-hidden="true">
              {adminDone ? "✓" : "1"}
            </span>
            <div>
              <strong>{t("dash.adminReview")}</strong>
              <p className="muted">
                {adminDone
                  ? t("pay.step.approved")
                  : "Your application is waiting for admin approval."}
              </p>
            </div>
          </li>
          <li className={registrationPaid ? "done" : ""}>
            <span className="pending-checklist__mark" aria-hidden="true">
              {registrationPaid ? "✓" : "2"}
            </span>
            <div>
              <strong>{t("dash.regDue", { amount: 3 })}</strong>
              <p className="muted">
                {registrationPaid
                  ? t("dash.regPaid")
                  : "Required for attendance and class chat."}
              </p>
              {!registrationPaid && (
                <Link className="btn primary" to="/dashboard/payment" style={{ marginTop: "0.75rem", display: "inline-block" }}>
                  {t("dash.payment")}
                </Link>
              )}
            </div>
          </li>
        </ul>

        <div className="dashboard-cards" style={{ marginTop: "1.25rem" }}>
          <Link to="/dashboard/payment" className="dashboard-card dashboard-card--pay">
            <h3>{t("dash.payment")}</h3>
            <p>
              {registrationPaid
                ? t("dash.paymentDescPaid")
                : t("dash.paymentDescDue", { amount: 3 })}
            </p>
          </Link>
        </div>

        <div className="status-details">
          <p><strong>{t("contact.name")}:</strong> {profile.fullName}</p>
          <p><strong>{t("apply.programme")}:</strong> {programmeName(profile)}</p>
          <p><strong>{t("apply.classMode")}:</strong> {classLabel}</p>
        </div>

        <MessagesBlock />
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
      <h1>{t("dash.welcome", { name: profile.fullName })}</h1>
      <p className="lede">
        Your account is active. You are enrolled in the{" "}
        <strong>{programmeName(profile)}</strong> programme ({classLabel}).
      </p>

      {profile.startDate && (
        <p className="muted">Started: {new Date(profile.startDate).toLocaleDateString()}</p>
      )}

      {progress && totalWeeks > 0 && (
        <div className="progress-hub" aria-label="Programme progress">
          <div className="progress-hub__stats">
            <div>
              <span className="progress-hub__label">{t("dash.week")}</span>
              <strong className="progress-hub__value">
                {Math.min(Math.max(currentWeek, 1), totalWeeks)} / {totalWeeks}
              </strong>
            </div>
            <div>
              <span className="progress-hub__label">{t("dash.attendanceLabel")}</span>
              <strong className="progress-hub__value">
                {t("dash.signed", { signed, pct: attendancePct })}
              </strong>
            </div>
          </div>
          <div className="progress-hub__bar" role="progressbar" aria-valuenow={programmePct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${programmePct}%` }} />
          </div>
          <p className="muted progress-hub__hint">
            {t("dash.programmeProgress", { pct: programmePct })}
          </p>
        </div>
      )}

      <div className="dashboard-cards">
        <Link to="/dashboard/library" className="dashboard-card">
          <h3>{t("dash.library")}</h3>
          <p>{t("dash.libraryDesc")}</p>
        </Link>

        <Link to="/dashboard/attendance" className="dashboard-card">
          <h3>{t("dash.attendance")}</h3>
          <p>{t("dash.attendanceDesc")}</p>
        </Link>

        <Link to="/dashboard/chat" className="dashboard-card">
          <h3>{t("dash.chat")}</h3>
          <p>{t("dash.chatDesc")}</p>
        </Link>

        <Link to="/dashboard/payment" className="dashboard-card">
          <h3>{t("dash.payment")}</h3>
          <p>{t("dash.paymentDescPaid")}</p>
        </Link>
      </div>
    </section>
  );
}
