import { useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "../lib/adminApi";
import { DocBrandHeader } from "../components/BrandMark";

type CreateResult = {
  id: string;
  sessionId: string;
  link: string;
  linkExpiresAt: string;
  message: string;
};

export function AdminCreateAgreementPage() {
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Create agreement | The Digital 26";
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await adminFetch<CreateResult>("/api/ops/agreements", {
        method: "POST",
        body: JSON.stringify({ clientEmail, clientName }),
      });
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
        For clients who want a website, collaboration, or our services. Creates a 24-hour signing
        link; the client tags what the deal is about and signs. Then the link expires and the letter
        goes public.
      </p>

      <form className="sign-form" onSubmit={onSubmit}>
        <label>
          Client email
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Client name
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create & email passkey"}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}

      {result && (
        <article className="result-card">
          <p>{result.message}</p>
          <dl>
            <div>
              <dt>Link</dt>
              <dd>
                <a href={result.link}>{result.link}</a>
              </dd>
            </div>
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
