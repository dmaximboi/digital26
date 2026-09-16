import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../lib/authApi";
import { programmeShort, programmeWeeks } from "../../lib/programme";

type StudentItem = {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  photoUrl: string | null;
  parentPhone: string | null;
  address: string | null;
  programme: "THREE_MONTH" | "FOUR_MONTH" | "FIVE_MONTH" | "SIX_MONTH" | "CUSTOM";
  customMonths: number | null;
  classMode: "PHYSICAL" | "ONLINE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  startDate: string | null;
  registrationPaid?: boolean;
  registrationPaidAt?: string | null;
  attendanceCount: number;
  messageCount: number;
  createdAt: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
};

type StudentMsg = {
  id: string;
  fromAdmin: boolean;
  body: string;
  createdAt: string;
};

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED";

export function AdminStudentsPage() {
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [items, setItems] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [chatOpen, setChatOpen] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<StudentMsg[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [editProg, setEditProg] = useState<string | null>(null);
  const [progValue, setProgValue] = useState("");
  const [customMonths, setCustomMonths] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ items: StudentItem[] }>("/api/ops/students")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const pending = items.filter((s) => s.status === "PENDING");
  const approved = items.filter((s) => s.status === "APPROVED");
  const rejected = items.filter((s) => s.status === "REJECTED");
  const counts = { PENDING: pending.length, APPROVED: approved.length, REJECTED: rejected.length };

  const visible = useMemo(() => {
    if (filter === "PENDING") return pending;
    if (filter === "APPROVED") return approved;
    return rejected;
  }, [filter, pending, approved, rejected]);

  async function approve(id: string) {
    setBusy(id);
    try {
      await apiFetch("/api/ops/students/" + id + "/approve", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function verifyPayment(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await apiFetch<{
        ok: boolean;
        reconcile?: { fulfilled: number; checked: number };
        result?: { ok: boolean; reason?: string };
      }>("/api/ops/payments/reconcile", {
        method: "POST",
        body: JSON.stringify({ profileId: id }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.reconcile?.fulfilled && !res.result?.ok) {
        setError("No paid Bachs checkout found for this student yet.");
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment verify failed");
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

  async function reconsider(id: string) {
    setBusy(id);
    try {
      await apiFetch("/api/ops/students/" + id + "/reconsider", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this student's approval? They will need to be re-approved.")) return;
    setBusy(id);
    try {
      await apiFetch("/api/ops/students/" + id + "/revoke", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function openChat(id: string) {
    if (chatOpen === id) {
      setChatOpen(null);
      return;
    }
    setChatOpen(id);
    setChatBody("");
    try {
      const d = await apiFetch<{ messages: StudentMsg[] }>(`/api/ops/students/${id}/messages`);
      setChatMessages(d.messages);
    } catch {
      setChatMessages([]);
    }
  }

  async function sendChatMsg() {
    if (!chatOpen || !chatBody.trim() || chatBusy) return;
    setChatBusy(true);
    try {
      await apiFetch(`/api/ops/students/${chatOpen}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: chatBody.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setChatBody("");
      const d = await apiFetch<{ messages: StudentMsg[] }>(`/api/ops/students/${chatOpen}/messages`);
      setChatMessages(d.messages);
    } catch {
      /* keep composer open */
    } finally {
      setChatBusy(false);
    }
  }

  async function saveProgramme(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/ops/students/${id}/update-programme`, {
        method: "POST",
        body: JSON.stringify({
          programme: progValue,
          customMonths: progValue === "CUSTOM" ? Number(customMonths) || 0 : null,
        }),
        headers: { "Content-Type": "application/json" },
      });
      setEditProg(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function progLabel(s: StudentItem) {
    return programmeShort(s.programme, s.customMonths);
  }

  return (
    <div className="ops-page students-ops">
      <div className="ops-page__head">
        <div>
          <h2>Students</h2>
          <p className="muted">Review applications, chat, update programmes, and revoke access from one card per student.</p>
        </div>
        {!canWrite && <p className="muted">Read-only access — approve and edit actions are hidden.</p>}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="student-filter" role="tablist">
        {(
          [
            ["PENDING", "Pending"],
            ["APPROVED", "Approved"],
            ["REJECTED", "Rejected"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? "is-active" : undefined}
            onClick={() => setFilter(id)}
          >
            {label}
            <span>{counts[id]}</span>
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading...</p>}

      {!loading && visible.length === 0 && (
        <div className="library-ops__empty">
          <p>No {filter.toLowerCase()} students.</p>
        </div>
      )}

      <div className="student-cards">
        {visible.map((s) => (
          <article key={s.id} className={`student-card student-card--${s.status.toLowerCase()}`}>
            <div className="student-card__main">
              <div className="student-card__photo">
                {s.photoUrl ? <img src={s.photoUrl} alt="" /> : <div className="no-photo" />}
              </div>
              <div className="student-card__info">
                <div className="student-card__title-row">
                  <h4>{s.fullName}</h4>
                  <span className={`student-card__badge student-card__badge--${s.status.toLowerCase()}`}>
                    {s.status === "PENDING" ? "Pending" : s.status === "APPROVED" ? "Approved" : "Rejected"}
                  </span>
                </div>
                <p className="muted">{s.user.email}</p>
                <div className="student-card__chips">
                  <span>{progLabel(s)}</span>
                  <span>{s.classMode === "ONLINE" ? "Online" : "Physical"}</span>
                  <span>{s.registrationPaid ? "Paid" : "Unpaid"}</span>
                  {s.status === "APPROVED" && (
                    <span>
                      Attendance {s.attendanceCount}/{programmeWeeks(s.programme, s.customMonths)}
                    </span>
                  )}
                </div>
                <div className="student-card__facts">
                  <p>Phone: {s.phone}</p>
                  {s.parentPhone && <p>Parent: {s.parentPhone}</p>}
                  {s.address && <p>Address: {s.address}</p>}
                  <p className="muted">
                    Applied {new Date(s.createdAt).toLocaleDateString()}
                    {s.startDate ? ` · Started ${new Date(s.startDate).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>
            </div>

            {s.status === "APPROVED" && canWrite && (
              <div className="student-card__programme">
                {editProg === s.id ? (
                  <div className="inline-edit">
                    <select value={progValue} onChange={(e) => setProgValue(e.target.value)}>
                      <option value="THREE_MONTH">3-Month</option>
                      <option value="FOUR_MONTH">4-Month</option>
                      <option value="FIVE_MONTH">5-Month</option>
                      <option value="SIX_MONTH">6-Month</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                    {progValue === "CUSTOM" && (
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={customMonths}
                        onChange={(e) => setCustomMonths(e.target.value)}
                        placeholder="Months"
                        className="form-input"
                      />
                    )}
                    <button className="btn sm primary" onClick={() => void saveProgramme(s.id)} disabled={busy === s.id}>
                      Save
                    </button>
                    <button className="btn sm" onClick={() => setEditProg(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setEditProg(s.id);
                      setProgValue(s.programme);
                      setCustomMonths(String(s.customMonths || ""));
                    }}
                  >
                    Change programme
                  </button>
                )}
              </div>
            )}

            <div className="student-card__actions">
              <div className="student-card__group">
                <span className="student-card__group-label">Open</span>
                <div className="student-card__group-btns">
                  <Link className="btn sm primary" to={`/admin/students/${s.id}/record`}>
                    Public record
                  </Link>
                  <button className="btn sm" onClick={() => void openChat(s.id)}>
                    {chatOpen === s.id ? "Close chat" : `Chat (${s.messageCount})`}
                  </button>
                </div>
              </div>

              {canWrite && s.status === "PENDING" && (
                <div className="student-card__group">
                  <span className="student-card__group-label">Decision</span>
                  <div className="student-card__group-btns">
                    <button className="btn sm primary" onClick={() => approve(s.id)} disabled={busy === s.id}>
                      Approve
                    </button>
                    <button className="btn sm danger" onClick={() => reject(s.id)} disabled={busy === s.id}>
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {canWrite && s.status === "APPROVED" && (
                <div className="student-card__group">
                  <span className="student-card__group-label">Access</span>
                  <div className="student-card__group-btns">
                    <button className="btn sm danger" onClick={() => revoke(s.id)} disabled={busy === s.id}>
                      Revoke
                    </button>
                  </div>
                </div>
              )}

              {canWrite && s.status === "REJECTED" && (
                <div className="student-card__group">
                  <span className="student-card__group-label">Decision</span>
                  <div className="student-card__group-btns">
                    <button className="btn sm primary" onClick={() => reconsider(s.id)} disabled={busy === s.id}>
                      Reconsider
                    </button>
                  </div>
                </div>
              )}

              {canWrite && !s.registrationPaid && (
                <div className="student-card__group">
                  <span className="student-card__group-label">Payment</span>
                  <div className="student-card__group-btns">
                    <button className="btn sm" onClick={() => void verifyPayment(s.id)} disabled={busy === s.id}>
                      Verify payment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {chatOpen === s.id && (
              <div className="admin-chat-panel">
                <h4>Chat with {s.fullName}</h4>
                <div className="student-msg-list">
                  {chatMessages.length === 0 && <p className="muted">No messages yet.</p>}
                  {chatMessages.map((m) => (
                    <div key={m.id} className={`student-msg ${m.fromAdmin ? "from-admin" : "from-student"}`}>
                      <span className="student-msg__label">{m.fromAdmin ? "You (Admin)" : s.fullName}</span>
                      <p className="student-msg__body">{m.body}</p>
                      <time className="student-msg__time">{new Date(m.createdAt).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
                {canWrite && (
                  <div className="student-msg-input">
                    <input
                      type="text"
                      value={chatBody}
                      onChange={(e) => setChatBody(e.target.value)}
                      placeholder="Reply to student..."
                      maxLength={500}
                      disabled={chatBusy}
                      className="form-input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void sendChatMsg();
                      }}
                    />
                    <button
                      className="btn sm primary"
                      onClick={() => void sendChatMsg()}
                      disabled={!chatBody.trim() || chatBusy}
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
