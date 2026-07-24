import { useEffect, useState, type FormEvent } from "react";
import { adminPostForm } from "../lib/adminApi";
import { DocBrandHeader } from "../components/BrandMark";
import { compressImage } from "../lib/compressImage";

type CreateResult = {
  id: string;
  sessionId: string;
  link: string;
  passkey?: string;
  emailDelivered?: boolean;
  emailError?: string | null;
  linkExpiresAt: string;
  message: string;
};

export function AdminCreateAgreementPage() {
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [proofs, setProofs] = useState<File[]>([]);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Create agreement | The Digital 26";
  }, []);

  async function onProofs(list: FileList | null) {
    if (!list) {
      setProofs([]);
      return;
    }
    const files = Array.from(list).slice(0, 3);
    const compressed: File[] = [];
    for (const f of files) {
      compressed.push(await compressImage(f));
    }
    setProofs(compressed);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (proofs.length !== 3) {
      setError("Upload exactly 3 proof images (deal evidence) before creating the link.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("clientEmail", clientEmail);
      if (clientName.trim()) form.append("clientName", clientName.trim());
      for (const f of proofs) form.append("proofs", f);
      const data = await adminPostForm<CreateResult>("/api/ops/agreements", form);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel nested">
      <DocBrandHeader title="Create agreement letter link" />
      <p className="lede">
        Upload 3 deal proofs first (proposal, chat, or payment). Then create the 24-hour signing
        link. The client will add 2 more proofs when they sign.
      </p>

      <form className="sign-form" onSubmit={onSubmit}>
        <label>
          Client email
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            required
            disabled={loading}
          />
        </label>
        <label>
          Client name
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            disabled={loading}
          />
        </label>
        <fieldset className="evidence-block" disabled={loading}>
          <legend>Required: 3 deal proof images</legend>
          <p className="muted">
            Upload screenshots of proposal, WhatsApp chat, payment, or any deal proof. Max 3.
            Client will upload 2 more when they sign.
          </p>
          <label className="evidence-field">
            Choose 3 images
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void onProofs(e.target.files)}
              required
            />
            <span className={proofs.length === 3 ? "ok-count" : "muted"}>
              {proofs.length}/3 selected
              {proofs.length > 0 && (
                <ul className="evidence-file-list">
                  {proofs.map((f) => (
                    <li key={`${f.name}-${f.size}`}>{f.name}</li>
                  ))}
                </ul>
              )}
            </span>
          </label>
        </fieldset>
        <button className="btn primary" type="submit" disabled={loading || proofs.length !== 3}>
          {loading ? "Creating…" : "Create & email passkey"}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}

      {result && (
        <article className="result-card">
          <p>{result.message}</p>
          {result.emailDelivered && (
            <p className="muted">
              Tell the client: if the email is missing, check Spam / Junk. In Gmail, mark Not spam
              and add the sender to Contacts.
            </p>
          )}
          {result.emailDelivered === false && (
            <p className="status error">
              Email was not delivered
              {result.emailError ? `: ${result.emailError}` : "."} Share the link and passkey with
              the client yourself.
            </p>
          )}
          <dl>
            <div>
              <dt>Link</dt>
              <dd>
                <a href={result.link}>{result.link}</a>
              </dd>
            </div>
            {result.passkey && (
              <div>
                <dt>Passkey</dt>
                <dd>
                  <code>{result.passkey}</code>
                </dd>
              </div>
            )}
            <div>
              <dt>Expires</dt>
              <dd>{new Date(result.linkExpiresAt).toLocaleString()}</dd>
            </div>
          </dl>
        </article>
      )}
    </section>
  );
}
