import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { apiFetch } from "../lib/authApi";
import { setPageMeta } from "../lib/seo";

type ChatMsg = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null; role?: string };
};

export function StudentChatPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [remaining, setRemaining] = useState(10);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageMeta({ title: t("chat.title"), description: "Chat with fellow students." });
  }, [t]);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  function loadMessages() {
    apiFetch<{ messages: ChatMsg[]; remaining: number }>("/api/student/chat")
      .then((d) => { setMessages(d.messages); setRemaining(d.remaining); })
      .catch(() => {});
  }

  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN" || user.role === "READONLY") {
      loadMessages();
      const interval = setInterval(loadMessages, 15_000);
      return () => clearInterval(interval);
    }
    apiFetch<{ fullyActive?: boolean }>("/api/student/payments/status")
      .then((s) => {
        if (!s.fullyActive) {
          navigate("/dashboard/payment", { replace: true });
          return;
        }
        loadMessages();
      })
      .catch(() => loadMessages());
    const interval = setInterval(loadMessages, 15_000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/student/chat", {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setBody("");
      loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "READONLY";
  const canPost = isAdmin ? Boolean(user?.canWrite) : true;
  const isUnlimited = user?.role === "ADMIN" || user?.role === "READONLY";

  if (loading) {
    return <section className="panel" aria-busy="true"><p className="muted">{t("common.loading")}</p></section>;
  }

  return (
    <section className="panel chat-page">
      <Link to={isAdmin ? "/admin" : "/dashboard"} className="back-link">&larr; {isAdmin ? t("admin.eyebrow") : t("dash.title")}</Link>
      <h1>{t("chat.title")}</h1>
      {user?.role !== "ADMIN" && user?.role !== "READONLY" && (
        <p className="muted">{t("chat.remaining", { n: remaining })}</p>
      )}
      {isAdmin && !canPost && (
        <p className="muted">{t("chat.readonly")}</p>
      )}

      <div className="chat-messages">
        {messages.length === 0 && <p className="muted chat-empty">{t("chat.empty")}</p>}
        {messages.map((m) => {
          const isMe = m.user.id === user?.id;
          return (
            <div key={m.id} className={`chat-bubble ${isMe ? "mine" : "other"}`}>
              <div className="chat-bubble__header">
                {m.user.avatarUrl && <img src={m.user.avatarUrl} alt="" className="chat-avatar" />}
                <span className="chat-name">
                  {isMe ? t("dash.you") : m.user.name}
                  {m.user.role === "ADMIN" && !isMe && <span className="chat-admin-tag"> ({t("dash.admin")})</span>}
                </span>
                <time className="chat-time">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
              <p className="chat-bubble__body">{m.body}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {canPost ? (
        <form className="chat-input" onSubmit={send}>
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isUnlimited || remaining > 0 ? t("chat.placeholder") : t("chat.limit")}
            maxLength={500}
            disabled={(!isUnlimited && remaining <= 0) || busy}
            className="form-input"
          />
          <button type="submit" className="btn primary" disabled={!body.trim() || busy || (!isUnlimited && remaining <= 0)}>
            {t("chat.send")}
          </button>
        </form>
      ) : null}
    </section>
  );
}
