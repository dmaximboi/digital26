import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminApi";

type Msg = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function AdminMessagesPage() {
  const [items, setItems] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const data = await adminFetch<{ items: Msg[]; unread: number }>("/api/ops/messages");
    setItems(data.items);
    setUnread(data.unread);
  }

  useEffect(() => {
    load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Failed"),
    );
  }, []);

  async function markRead(id: string) {
    setBusy(id);
    try {
      await adminFetch(`/api/ops/messages/${encodeURIComponent(id)}/read`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this message?")) return;
    setBusy(id);
    try {
      await adminFetch(`/api/ops/messages/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (openId === id) setOpenId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
    const msg = items.find((m) => m.id === id);
    if (msg && !msg.readAt) void markRead(id);
  }

  return (
    <div className="ops-page">
      <div className="ops-page__head">
        <div>
          <h2>Messages</h2>
          <p className="muted">
            {unread > 0 ? `${unread} unread` : "Inbox clear"} · from the public contact form
          </p>
        </div>
      </div>

      {error && <p className="status error">{error}</p>}

      {items.length === 0 ? (
        <p className="muted">No messages yet.</p>
      ) : (
        <ul className="msg-list">
          {items.map((m) => (
            <li key={m.id} className={`msg-card${m.readAt ? "" : " msg-card--unread"}`}>
              <button type="button" className="msg-card__top" onClick={() => toggle(m.id)}>
                <div>
                  <strong>{m.name}</strong>
                  <span className="muted"> · {m.email}</span>
                  {!m.readAt && <span className="badge ok">New</span>}
                </div>
                <div className="msg-card__meta">
                  <span>{m.subject || "No subject"}</span>
                  <span className="muted">{new Date(m.createdAt).toLocaleString()}</span>
                </div>
              </button>
              {openId === m.id && (
                <div className="msg-card__body">
                  {m.phone && <p className="muted">Phone: {m.phone}</p>}
                  <p className="msg-card__text">{m.body}</p>
                  <div className="msg-card__actions">
                    <a className="btn" href={`mailto:${m.email}`}>
                      Reply by email
                    </a>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy === m.id}
                      onClick={() => void remove(m.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
