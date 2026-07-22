import { useState, type FormEvent } from "react";
import { adminFetch } from "../lib/adminApi";
import { DocBrandHeader } from "../components/BrandMark";
import { browserLocalDateValue, formatCertDate } from "../lib/dates";

type InviteResult = {
  id: string;
  type: string;
  course: string;
  issueDate: string;
  claimSessionId: string;
  claimLink: string;
  claimExpiresAt: string;
  hoursValid: number;
  status: string;
  inviteEmail: string;
  emailDelivered?: boolean;
  emailError?: string | null;
  message: string;
};

export function AdminIssueCertificatePage() {
  const [studentEmail, setStudentEmail] = useState("");
  const [type, setType] = useState("COMPLETION");
  const [course, setCourse] = useState("6-Day Vibe Coding Masterclass");
  const [issueDate, setIssueDate] = useState(() => browserLocalDateValue());
  const [result, setResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!issueDate) {
      setError("Set the issue date yourself (defaults to today in your browser).");
      return;
    }
    if (!studentEmail.trim()) {
      setError("Student email is required — they must use this same email to claim.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const iso = new Date(`${issueDate}T12:00:00`).toISOString();
      const data = await adminFetch<InviteResult>("/api/ops/certificates", {
        method: "POST",
        body: JSON.stringify({
          studentEmail: studentEmail.trim(),
          type,
          course,
          issueDate: iso,
        }),
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
      <DocBrandHeader title="Create certificate claim link" />
      <p className="lede">
        Student email is locked to this invite. They must enter the same address before OTP and
        submit. After claim, the letter goes public and the link expires.
      </p>

      <form className="sign-form" onSubmit={onSubmit}>
        <label>
          Student email (required — locked to claim)
          <input
            type="email"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            placeholder="student@gmail.com"
            required
            disabled={loading}
          />
        </label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
            <option value="COMPLETION">Completion</option>
            <option value="PARTICIPATION">Participation</option>
          </select>
        </label>
        <label>
          Course
          <input
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            required
            disabled={loading}
          />
        </label>
        <label>
          Issue date (you control this)
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
            disabled={loading}
          />
          <span className="muted">Preview: {formatCertDate(issueDate)}</span>
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create 24h claim link"}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}

      {result && (
        <article className="result-card">
          <p>{result.message}</p>
          {result.emailDelivered && (
            <p className="muted">
              Ask the student to check Spam / Junk if needed, mark Not spam in Gmail, and add the
              sender to Contacts.
            </p>
          )}
          {result.emailDelivered === false && (
            <p className="status error">
              Email was not delivered
              {result.emailError ? `: ${result.emailError}` : "."} Share the claim link with the
              student yourself.
            </p>
          )}
          <dl>
            <div>
              <dt>Locked email</dt>
              <dd>{result.inviteEmail}</dd>
            </div>
            <div>
              <dt>Claim link</dt>
              <dd>
                <a href={result.claimLink}>{result.claimLink}</a>
              </dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{new Date(result.claimExpiresAt).toLocaleString()}</dd>
            </div>
          </dl>
        </article>
      )}
    </section>
  );
}
