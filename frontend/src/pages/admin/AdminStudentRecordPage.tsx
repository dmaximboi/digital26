import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../lib/authApi";

type Project = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  completedAt: string | null;
};
type Credential = {
  id: string;
  title: string;
  url: string;
  issuer: string | null;
  earnedAt: string | null;
};
type Assessment = {
  id: string;
  kind: "PERFORMANCE" | "TEST" | "EXAMINATION";
  title: string;
  score: string | null;
  maxScore: string | null;
  notes: string | null;
  takenAt: string | null;
};
type IssuedCert = {
  publicId: string | null;
  type: string;
  course: string;
  issueDate: string;
  status: string;
};
type RecordPayload = {
  student: {
    id: string;
    fullName: string;
    email: string;
    photoUrl: string | null;
    programmeLabel: string;
    classMode: string;
    headline: string | null;
    directorComment: string | null;
    status: string;
  };
  projects: Project[];
  credentials: Credential[];
  assessments: Assessment[];
  certificates: IssuedCert[];
};

const emptyProject = { title: "", url: "", description: "", completedAt: "" };
const emptyCred = { title: "", url: "", issuer: "", earnedAt: "" };
const emptyAssess = {
  kind: "PERFORMANCE" as Assessment["kind"],
  title: "",
  score: "",
  maxScore: "",
  notes: "",
  takenAt: "",
};

export function AdminStudentRecordPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [data, setData] = useState<RecordPayload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [comment, setComment] = useState("");
  const [project, setProject] = useState(emptyProject);
  const [cred, setCred] = useState(emptyCred);
  const [assess, setAssess] = useState(emptyAssess);

  const apply = useCallback((next: RecordPayload) => {
    setData(next);
    setHeadline(next.student.headline || "");
    setComment(next.student.directorComment || "");
  }, []);

  const load = useCallback(() => {
    apiFetch<RecordPayload>(`/api/ops/students/${id}/record`)
      .then(apply)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id, apply]);

  useEffect(load, [load]);

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await apiFetch<RecordPayload>(`/api/ops/students/${id}/record`, {
        method: "POST",
        body: JSON.stringify({ headline, directorComment: comment }),
      });
      apply(next);
      setNotice("Profile comment saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addItem(path: string, body: unknown, reset: () => void) {
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await apiFetch<RecordPayload>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      apply(next);
      reset();
      setNotice("Added to the public record.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(path: string) {
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await apiFetch<RecordPayload>(path, { method: "POST", body: "{}" });
      apply(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="muted">{error || "Loading student record…"}</p>;
  }

  const publicCert = data.certificates.find((c) => c.publicId && c.status === "VALID");
  const grouped = {
    PERFORMANCE: data.assessments.filter((a) => a.kind === "PERFORMANCE"),
    TEST: data.assessments.filter((a) => a.kind === "TEST"),
    EXAMINATION: data.assessments.filter((a) => a.kind === "EXAMINATION"),
  };

  return (
    <div className="admin-record">
      <div className="ops-page-head">
        <div>
          <p className="muted">
            <Link to="/admin/students">← Students</Link>
          </p>
          <h2 className="ops-page-title">Public student record</h2>
          <p className="muted">
            Everything here appears on the student’s certificate profile. Phone and email stay
            private.
          </p>
        </div>
        {publicCert?.publicId && (
          <a className="btn" href={`/verify/${publicCert.publicId}`} target="_blank" rel="noreferrer">
            View public page
          </a>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      <header className="admin-record__hero">
        <div className="admin-record__photo">
          {data.student.photoUrl ? (
            <img src={data.student.photoUrl} alt="" />
          ) : (
            <span>{data.student.fullName.slice(0, 1)}</span>
          )}
        </div>
        <div>
          <h3>{data.student.fullName}</h3>
          <p className="muted">{data.student.email}</p>
          <p>
            {data.student.programmeLabel} · {data.student.classMode}
          </p>
        </div>
      </header>

      <form className="admin-record__block" onSubmit={(e) => void saveMeta(e)}>
        <h3>Headline & director comment</h3>
        <label className="form-label">
          Headline
          <input
            className="form-input"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={200}
            disabled={!canWrite || busy}
            placeholder="e.g. Vibe coder · shipped 4 live apps"
          />
        </label>
        <label className="form-label">
          Director comment
          <textarea
            className="form-input form-textarea"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={4000}
            rows={5}
            disabled={!canWrite || busy}
            placeholder="Public comment from the director about this student…"
          />
        </label>
        {canWrite && (
          <button className="btn primary" type="submit" disabled={busy}>
            Save comment
          </button>
        )}
      </form>

      <section className="admin-record__block">
        <h3>Issued Digital 26 certificates</h3>
        {data.certificates.length === 0 ? (
          <p className="muted">No certificates issued yet. Issue one from Certificates.</p>
        ) : (
          <ul className="admin-record__list">
            {data.certificates.map((c) => (
              <li key={c.publicId || c.course}>
                <strong>{c.publicId || "pending"}</strong>
                <span>
                  {c.type} · {c.course} · {c.status}
                </span>
                {c.publicId && (
                  <a href={`/verify/${c.publicId}`} target="_blank" rel="noreferrer">
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-record__block">
        <h3>Project links</h3>
        <ul className="admin-record__list">
          {data.projects.map((p) => (
            <li key={p.id}>
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.title}
              </a>
              {canWrite && (
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => void removeItem(`/api/ops/students/${id}/projects/${p.id}/delete`)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {canWrite && (
          <form
            className="admin-record__add"
            onSubmit={(e) => {
              e.preventDefault();
              void addItem(`/api/ops/students/${id}/projects`, project, () =>
                setProject(emptyProject),
              );
            }}
          >
            <input
              className="form-input"
              required
              placeholder="Project title"
              value={project.title}
              onChange={(e) => setProject((s) => ({ ...s, title: e.target.value }))}
            />
            <input
              className="form-input"
              required
              type="url"
              placeholder="https://…"
              value={project.url}
              onChange={(e) => setProject((s) => ({ ...s, url: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Short description"
              value={project.description}
              onChange={(e) => setProject((s) => ({ ...s, description: e.target.value }))}
            />
            <input
              className="form-input"
              type="date"
              value={project.completedAt}
              onChange={(e) => setProject((s) => ({ ...s, completedAt: e.target.value }))}
            />
            <button className="btn primary" type="submit" disabled={busy}>
              Add project
            </button>
          </form>
        )}
      </section>

      <section className="admin-record__block">
        <h3>Other certificate links</h3>
        <ul className="admin-record__list">
          {data.credentials.map((c) => (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.title}
              </a>
              <span className="muted">{c.issuer}</span>
              {canWrite && (
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    void removeItem(`/api/ops/students/${id}/credentials/${c.id}/delete`)
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {canWrite && (
          <form
            className="admin-record__add"
            onSubmit={(e) => {
              e.preventDefault();
              void addItem(`/api/ops/students/${id}/credentials`, cred, () => setCred(emptyCred));
            }}
          >
            <input
              className="form-input"
              required
              placeholder="Certificate title"
              value={cred.title}
              onChange={(e) => setCred((s) => ({ ...s, title: e.target.value }))}
            />
            <input
              className="form-input"
              required
              type="url"
              placeholder="https://…"
              value={cred.url}
              onChange={(e) => setCred((s) => ({ ...s, url: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Issuer"
              value={cred.issuer}
              onChange={(e) => setCred((s) => ({ ...s, issuer: e.target.value }))}
            />
            <input
              className="form-input"
              type="date"
              value={cred.earnedAt}
              onChange={(e) => setCred((s) => ({ ...s, earnedAt: e.target.value }))}
            />
            <button className="btn primary" type="submit" disabled={busy}>
              Add certificate link
            </button>
          </form>
        )}
      </section>

      <section className="admin-record__block">
        <h3>Performance, tests & examinations</h3>
        {(["PERFORMANCE", "TEST", "EXAMINATION"] as const).map((kind) => (
          <div key={kind} className="admin-record__kind">
            <h4>{kind === "PERFORMANCE" ? "Performance" : kind === "TEST" ? "Test assessment" : "Examination"}</h4>
            <ul className="admin-record__list">
              {grouped[kind].map((a) => (
                <li key={a.id}>
                  <strong>{a.title}</strong>
                  <span>
                    {[a.score, a.maxScore].filter(Boolean).join(" / ") || "No score"}
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busy}
                      onClick={() =>
                        void removeItem(`/api/ops/students/${id}/assessments/${a.id}/delete`)
                      }
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {canWrite && (
          <form
            className="admin-record__add"
            onSubmit={(e) => {
              e.preventDefault();
              void addItem(`/api/ops/students/${id}/assessments`, assess, () =>
                setAssess(emptyAssess),
              );
            }}
          >
            <select
              className="form-input"
              value={assess.kind}
              onChange={(e) =>
                setAssess((s) => ({ ...s, kind: e.target.value as Assessment["kind"] }))
              }
            >
              <option value="PERFORMANCE">Performance</option>
              <option value="TEST">Test assessment</option>
              <option value="EXAMINATION">Examination</option>
            </select>
            <input
              className="form-input"
              required
              placeholder="Title"
              value={assess.title}
              onChange={(e) => setAssess((s) => ({ ...s, title: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Score"
              value={assess.score}
              onChange={(e) => setAssess((s) => ({ ...s, score: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Max score"
              value={assess.maxScore}
              onChange={(e) => setAssess((s) => ({ ...s, maxScore: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Notes"
              value={assess.notes}
              onChange={(e) => setAssess((s) => ({ ...s, notes: e.target.value }))}
            />
            <input
              className="form-input"
              type="date"
              value={assess.takenAt}
              onChange={(e) => setAssess((s) => ({ ...s, takenAt: e.target.value }))}
            />
            <button className="btn primary" type="submit" disabled={busy}>
              Add record
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
