import { useEffect, useState, type FormEvent } from "react";
import { DocBrandHeader } from "../components/BrandMark";
import { useT } from "../i18n/LocaleContext";
import { apiPost } from "../lib/api";
import { setPageMeta } from "../lib/seo";

export function ContactPage() {
  const t = useT();
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
      title: t("contact.metaTitle"),
      description: t("contact.lede"),
      path: "/contact",
    });
  }, [t]);

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
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <DocBrandHeader title={t("contact.title")} />
      <p className="lede">{t("contact.lede")}</p>

      <div className="contact-whatsapp">
        <a
          href="https://wa.me/2349123165792"
          target="_blank"
          rel="noreferrer"
          className="btn primary whatsapp-btn"
        >
          {t("contact.whatsapp")}
        </a>
        <span className="muted">+234 91 23 16 5792</span>
      </div>

      {done ? (
        <article className="result-card">
          <p className="badge ok">Sent</p>
          <h2>{t("contact.thanks")}</h2>
          <p className="muted">{t("contact.thanksBody")}</p>
          <button type="button" className="btn" onClick={() => setDone(false)}>
            {t("contact.another")}
          </button>
        </article>
      ) : (
        <form className="sign-form contact-form" onSubmit={onSubmit}>
          <label>
            {t("contact.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t("contact.email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            {t("contact.phone")}
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
            {t("contact.message")}
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
            {loading ? t("contact.sending") : t("contact.send")}
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
