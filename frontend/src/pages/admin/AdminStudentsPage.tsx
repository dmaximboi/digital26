import { useCallback, useEffect, useState } from "react";
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

export function AdminStudentsPage() {
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [items, setItems] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
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
      await apiFetch("/api/ops/students/" + id + "/reconsider", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
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
      await apiFetch("/api/ops/students/" + id + "/revoke", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function openChat(id: string) {
    if (chatOpen === id) { setChatOpen(null); return; }
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
    } catch {} finally {
      setChatBusy(false);
    }
  }

  async function saveProgramme(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/ops/students/${id}/update-programme`, {
        method: "POST",
        body: JSON.stringify({ programme: progValue, customMonths: progValue === "CUSTOM" ? Number(customMonths) || 0 : null }),
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

  const pending = items.filter((s) => s.status === "PENDING");
  const approved = items.filter((s) => s.status === "APPROVED");
  const rejected = items.filter((s) => s.status === "REJECTED");

  return (
    <div>
      <div className="ops-page-head">
        <h2 className="ops-page-title">Students</h2>
        {!canWrite && <p className="muted">Read-only access approve and edit actions are hidden.</p>}
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
                    {progLabel(s)} · {s.classMode === "ONLINE" ? "Online" : "Physical"}
                  </p>
                  <p className="muted">
                    Applied: {new Date(s.createdAt).toLocaleDateString()} ·{" "}
                    {s.registrationPaid ? "Registration paid" : "Registration unpaid"}
                  </p>
                </div>
                <div className="student-card__actions">
                  {canWrite && (
                    <>
                      <button className="btn primary" onClick={() => approve(s.id)} disabled={busy === s.id}>
                        Approve
                      </button>
                      <button className="btn danger" onClick={() => reject(s.id)} disabled={busy === s.id}>
                        Reject
                      </button>
                      {!s.registrationPaid && (
                        <button className="btn" onClick={() => void verifyPayment(s.id)} disabled={busy === s.id}>
                          Verify payment
                        </button>
                      )}
                    </>
                  )}
                  <button className="btn" onClick={() => void openChat(s.id)}>
                    {chatOpen === s.id ? "Close chat" : `Chat (${s.messageCount})`}
                  </button>
                </div>
                {chatOpen === s.id && (
                  <div className="admin-chat-panel">
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
                          onKeyDown={(e) => { if (e.key === "Enter") void sendChatMsg(); }}
                        />
                        <button className="btn primary" onClick={() => void sendChatMsg()} disabled={!chatBody.trim() || chatBusy}>
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
                <th>Class</th>
                <th>Paid</th>
                <th>Attendance</th>
                <th>Started</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>{s.user.email}</td>
                  <td>
                    {canWrite && editProg === s.id ? (
                      <div className="inline-edit">
                        <select value={progValue} onChange={(e) => setProgValue(e.target.value)}>
                          <option value="THREE_MONTH">3-Month</option>
                          <option value="FOUR_MONTH">4-Month</option>
                          <option value="FIVE_MONTH">5-Month</option>
                          <option value="SIX_MONTH">6-Month</option>
                          <option value="CUSTOM">Custom</option>
                        </select>
                        {progValue === "CUSTOM" && (
                          <input type="number" min={1} max={24} value={customMonths}
                            onChange={(e) => setCustomMonths(e.target.value)} placeholder="Months" className="form-input" style={{ width: 70 }} />
                        )}
                        <button className="btn primary" onClick={() => void saveProgramme(s.id)} disabled={busy === s.id}>Save</button>
                        <button className="btn" onClick={() => setEditProg(null)}>Cancel</button>
                      </div>
                    ) : (
                      <span
                        onClick={canWrite ? () => { setEditProg(s.id); setProgValue(s.programme); setCustomMonths(String(s.customMonths || "")); } : undefined}
                        className={canWrite ? "editable" : undefined}
                      >
                        {progLabel(s)}
                      </span>
                    )}
                  </td>
                  <td>{s.classMode === "ONLINE" ? "Online" : "Physical"}</td>
                  <td>{s.registrationPaid ? "Yes" : "No"}</td>
                  <td>{s.attendanceCount} / {programmeWeeks(s.programme, s.customMonths)}</td>
                  <td>{s.startDate ? new Date(s.startDate).toLocaleDateString() : ""}</td>
                  <td>
                    <button className="btn" onClick={() => void openChat(s.id)}>
                      Chat ({s.messageCount})
                    </button>
                    {canWrite && !s.registrationPaid && (
                      <button className="btn" onClick={() => void verifyPayment(s.id)} disabled={busy === s.id}>
                        Verify payment
                      </button>
                    )}
                    {canWrite && (
                      <button className="btn danger" onClick={() => revoke(s.id)} disabled={busy === s.id}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {chatOpen && approved.some((s) => s.id === chatOpen) && (
            <div className="admin-chat-panel standalone">
              <h4>Chat with {approved.find((s) => s.id === chatOpen)?.fullName}</h4>
              <div className="student-msg-list">
                {chatMessages.length === 0 && <p className="muted">No messages yet.</p>}
                {chatMessages.map((m) => (
                  <div key={m.id} className={`student-msg ${m.fromAdmin ? "from-admin" : "from-student"}`}>
                    <span className="student-msg__label">{m.fromAdmin ? "You (Admin)" : "Student"}</span>
                    <p className="student-msg__body">{m.body}</p>
                    <time className="student-msg__time">{new Date(m.createdAt).toLocaleString()}</time>
                  </div>
                ))}
              </div>
              {canWrite && (
                <div className="student-msg-input">
                  <input type="text" value={chatBody} onChange={(e) => setChatBody(e.target.value)}
                    placeholder="Reply..." maxLength={500} disabled={chatBusy} className="form-input"
                    onKeyDown={(e) => { if (e.key === "Enter") void sendChatMsg(); }} />
                  <button className="btn primary" onClick={() => void sendChatMsg()} disabled={!chatBody.trim() || chatBusy}>Send</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {rejected.length > 0 && (
        <>
          <h3 className="ops-section-title">Rejected ({rejected.length})</h3>
          <table className="ops-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Programme</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rejected.map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>{s.user.email}</td>
                  <td>{progLabel(s)}</td>
                  <td>
                    {canWrite && (
                      <button className="btn primary" onClick={() => reconsider(s.id)} disabled={busy === s.id}>
                        Reconsider
                      </button>
                    )}
                    <button className="btn" onClick={() => void openChat(s.id)}>
                      Chat ({s.messageCount})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {chatOpen && rejected.some((s) => s.id === chatOpen) && (
            <div className="admin-chat-panel standalone">
              <h4>Chat with {rejected.find((s) => s.id === chatOpen)?.fullName}</h4>
              <div className="student-msg-list">
                {chatMessages.length === 0 && <p className="muted">No messages yet.</p>}
                {chatMessages.map((m) => (
                  <div key={m.id} className={`student-msg ${m.fromAdmin ? "from-admin" : "from-student"}`}>
                    <span className="student-msg__label">{m.fromAdmin ? "You (Admin)" : "Student"}</span>
                    <p className="student-msg__body">{m.body}</p>
                    <time className="student-msg__time">{new Date(m.createdAt).toLocaleString()}</time>
                  </div>
                ))}
              </div>
              {canWrite && (
                <div className="student-msg-input">
                  <input type="text" value={chatBody} onChange={(e) => setChatBody(e.target.value)}
                    placeholder="Reply..." maxLength={500} disabled={chatBusy} className="form-input"
                    onKeyDown={(e) => { if (e.key === "Enter") void sendChatMsg(); }} />
                  <button className="btn primary" onClick={() => void sendChatMsg()} disabled={!chatBody.trim() || chatBusy}>Send</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
