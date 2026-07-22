import { useEffect, useState, type FormEvent } from "react";
import { DocBrandHeader } from "../components/BrandMark";
import { apiPost } from "../lib/api";
import { setPageMeta } from "../lib/seo";

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: "Contact",
      description:
        "Contact The Digital 26 about the 3-month Vibe Coding masterclass, websites, apps, or agreements.",
      path: "/contact",
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/api/public/contact", {
        name,
        email,
        phone: phone || undefined,
        subject: subject || undefined,
        message,
      });
      setDone(true);
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <DocBrandHeader title="Contact" />
      <p className="lede">
        Websites, collaboration, masterclass questions — send a message. It goes straight to The
        Digital 26 inbox.
      </p>

      {done ? (
        <article className="result-card">
          <p className="badge ok">Sent</p>
          <h2>Thank you</h2>
          <p className="muted">We’ve received your message and will reply soon.</p>
          <button type="button" className="btn" onClick={() => setDone(false)}>
            Send another
          </button>
        </article>
      ) : (
        <form className="sign-form contact-form" onSubmit={onSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Phone (optional)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Subject (optional)
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Website · collab · class…"
              maxLength={120}
            />
          </label>
          <label>
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              minLength={10}
              maxLength={2000}
              required
            />
          </label>
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send message"}
          </button>
        </form>
      )}

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
