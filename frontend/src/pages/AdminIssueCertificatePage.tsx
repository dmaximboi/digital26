import { useState, type FormEvent } from "react";
import { adminPostForm } from "../lib/adminApi";
import { DocBrandHeader } from "../components/BrandMark";
import { browserLocalDateValue, formatCertDate } from "../lib/dates";
import { compressImage } from "../lib/compressImage";

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
  const [adminSolo, setAdminSolo] = useState<File | null>(null);
  const [studentSolo, setStudentSolo] = useState<File | null>(null);
  const [together, setTogether] = useState<File | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pick(file: File | null, setter: (f: File | null) => void) {
    if (!file) {
      setter(null);
      return;
    }
    setter(await compressImage(file));
  }

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
    if (!adminSolo || !studentSolo || !together) {
      setError("Upload admin-only, student-only, and admin+student evidence photos.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const iso = new Date(`${issueDate}T12:00:00`).toISOString();
      const form = new FormData();
      form.append("studentEmail", studentEmail.trim());
      form.append("type", type);
      form.append("course", course);
      form.append("issueDate", iso);
      form.append("adminSolo", adminSolo);
      form.append("studentSolo", studentSolo);
      form.append("together", together);
      const data = await adminPostForm<InviteResult>("/api/ops/certificates", form);
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
        Before sending the link, upload 3 evidence photos: admin only, student only, and both
        together. The student still uploads a passport portrait plus 1 evidence image at claim.
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
        <fieldset className="evidence-block" disabled={loading}>
          <legend>Required: classroom evidence photos</legend>
          <p className="muted">
            Upload 3 images before creating the link. Student passport/portrait is uploaded later
            on the claim page (separate from the 1 student evidence image).
          </p>
          <label className="evidence-field">
            1. Admin only
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => void pick(e.target.files?.[0] ?? null, setAdminSolo)}
            />
            <span className="muted">{adminSolo ? adminSolo.name : "Not selected"}</span>
          </label>
          <label className="evidence-field">
            2. Student only
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => void pick(e.target.files?.[0] ?? null, setStudentSolo)}
            />
            <span className="muted">{studentSolo ? studentSolo.name : "Not selected"}</span>
          </label>
          <label className="evidence-field">
            3. Admin + student together
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => void pick(e.target.files?.[0] ?? null, setTogether)}
            />
            <span className="muted">{together ? together.name : "Not selected"}</span>
          </label>
        </fieldset>
        <button
          className="btn primary"
          type="submit"
          disabled={loading || !adminSolo || !studentSolo || !together}
        >
          {loading ? "Creating…" : "Create 24h claim link"}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}

      {result && (
        <article className="result-card">
          <p>{result.message}</p>
          {result.emailDelivered && (
            <p className="muted">
              Tell the student: if the email is missing, check Spam / Junk. In Gmail, mark Not spam
              and add the sender to Contacts.
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
