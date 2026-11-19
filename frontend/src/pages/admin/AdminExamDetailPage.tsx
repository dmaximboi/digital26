import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useT } from "../../i18n/LocaleContext";
import type { MessageKey } from "../../i18n/locales/en";
import { apiFetch } from "../../lib/authApi";

type Question = { id: string; prompt: string; marks: number; choices?: string[] };
type SessionRow = {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  studentName: string;
  studentId: string;
  submittedAt: string | null;
  score: string | null;
  maxScore: string | null;
  warnings: Record<string, number>;
};
type ExamDetail = {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  maxScore: string;
  questions: Question[];
  sessions: SessionRow[];
  access: { id: string; fullName: string; email: string }[];
};
type RosterStudent = {
  id: string;
  fullName: string;
  status: string;
  registrationPaid?: boolean;
  user?: { email: string };
};
type Submission = {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  title: string;
  studentName: string;
  studentId: string;
  score: string | null;
  maxScore: string | null;
  feedback: string | null;
  events: { kind: string; createdAt: string }[];
  questions: { id: string; prompt: string; marks: number; response: string; choice?: string; choices?: string[] }[];
};

export function AdminExamDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id = "", sessionId = "" } = useParams();
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState("");
  const [marks, setMarks] = useState("1");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    apiFetch<{ exam: ExamDetail }>(`/api/ops/examinations/${id}`)
      .then((d) => {
        setExam(d.exam);
        setPicked(d.exam.access.map((row) => row.id));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("common.error")));
  }, [id, t]);

  useEffect(() => {
    apiFetch<{ items: RosterStudent[] }>("/api/ops/students")
      .then((d) => setRoster(d.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("common.error")));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!id || !sessionId) {
      setSubmission(null);
      return;
    }
    apiFetch<{ session: Submission }>(`/api/ops/examinations/${id}/sessions/${sessionId}`)
      .then((d) => {
        setSubmission(d.session);
        setScore(d.session.score ?? "");
        setFeedback(d.session.feedback ?? "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("common.error")));
  }, [id, sessionId, t]);

  async function addQuestion(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/ops/examinations/${id}/questions`, {
        method: "POST",
        body: JSON.stringify({
          prompt,
          marks: Number(marks),
          choices: options
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 6),
        }),
      });
      setPrompt("");
      setOptions("");
      setMarks("1");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(questionId: string) {
    if (!canWrite) return;
    setError("");
    try {
      await apiFetch(`/api/ops/examinations/${id}/questions/${questionId}/delete`, { method: "POST", body: "{}" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  function toggleStudent(studentId: string) {
    setPicked((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId],
    );
  }

  async function saveAccess() {
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/ops/examinations/${id}/access`, {
        method: "PUT",
        body: JSON.stringify({ studentProfileIds: picked }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(action: "publish" | "close") {
    if (!canWrite) return;
    setError("");
    try {
      await apiFetch(`/api/ops/examinations/${id}/${action}`, { method: "POST", body: "{}" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function deleteExam() {
    if (!canWrite || busy) return;
    if (!window.confirm(t("adminExam.deleteConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/ops/examinations/${id}/delete`, { method: "POST", body: "{}" });
      navigate("/admin/examinations", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  async function saveGrade(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/ops/examinations/${id}/sessions/${sessionId}/grade`, {
        method: "POST",
        body: JSON.stringify({ score, feedback }),
      });
      const fresh = await apiFetch<{ session: Submission }>(`/api/ops/examinations/${id}/sessions/${sessionId}`);
      setSubmission(fresh.session);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!exam) {
    return <p className="muted">{error || t("common.loading")}</p>;
  }

  const locked = exam.sessions.length > 0;

  const eligible = roster.filter((student) => student.status === "APPROVED");

  return (
    <div className="ops-page exam-admin">
      <header className="exam-admin__head">
        <div>
          <p>
            <Link to="/admin/examinations">{t("common.back")}</Link>
          </p>
          <h2>{exam.title}</h2>
          <p className="muted">
            {statusLabel(exam.status, t)} · {exam.durationMinutes} min · {t("exam.score")} {exam.maxScore}
          </p>
          {exam.instructions && <p>{exam.instructions}</p>}
        </div>
        <div className="exam-admin__actions">
          {canWrite && exam.status !== "PUBLISHED" && (
            <button type="button" className="btn primary" onClick={() => void setStatus("publish")}>
              {t("adminExam.publish")}
            </button>
          )}
          {canWrite && exam.status === "PUBLISHED" && (
            <button type="button" className="btn" onClick={() => void setStatus("close")}>
              {t("adminExam.close")}
            </button>
          )}
          {canWrite && (
            <button type="button" className="btn danger" disabled={busy} onClick={() => void deleteExam()}>
              {t("adminExam.delete")}
            </button>
          )}
        </div>
      </header>
      {error && <p className="status error">{error}</p>}

      <section className="exam-panel exam-access-panel">
        <h3>{t("adminExam.access")}</h3>
        <p className="muted">{t("adminExam.accessHint")}</p>
        <ul className="exam-access">
          {eligible.map((student) => (
            <li key={student.id}>
              <label>
                <input
                  type="checkbox"
                  checked={picked.includes(student.id)}
                  disabled={!canWrite}
                  onChange={() => toggleStudent(student.id)}
                />
                <span>
                  {student.fullName}
                  {student.user?.email ? <small>{student.user.email}</small> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {eligible.length === 0 && <p className="muted">{t("adminExam.accessEmpty")}</p>}
        {canWrite && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void saveAccess()}>
            {t("adminExam.saveAccess")}
          </button>
        )}
      </section>

      <section className="exam-panel">
          <h3>{t("adminExam.questions")}</h3>
          <ol className="exam-sheet">
            {exam.questions.map((q, index) => (
              <li key={q.id}>
                <p>
                  <strong>
                    {index + 1}. {q.prompt}
                  </strong>
                </p>
                <p className="muted">{t("exam.marks", { marks: q.marks })}</p>
                {(q.choices ?? []).length > 0 && <p className="muted">{(q.choices ?? []).join(" · ")}</p>}
                {canWrite && !locked && (
                  <button type="button" className="btn sm" onClick={() => void removeQuestion(q.id)}>
                    {t("adminExam.remove")}
                  </button>
                )}
              </li>
            ))}
          </ol>
          {canWrite && !locked && (
            <form className="exam-admin-form" onSubmit={(e) => void addQuestion(e)}>
              <label>
                {t("adminExam.prompt")}
                <textarea className="form-input" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} required minLength={2} />
              </label>
              <label>
                {t("adminExam.options")}
                <textarea className="form-input" rows={3} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={t("adminExam.optionsHint")} />
              </label>
              <label>
                {t("adminExam.points")}
                <input className="form-input" type="number" min={1} max={100} value={marks} onChange={(e) => setMarks(e.target.value)} required />
              </label>
              <button className="btn primary" type="submit" disabled={busy}>
                {t("adminExam.addQuestion")}
              </button>
            </form>
          )}
          {locked && <p className="muted">{t("adminExam.locked")}</p>}
        </section>

      <section className="exam-panel">
        <h3>{t("adminExam.submissions")}</h3>
        {exam.sessions.length === 0 && <p className="muted">{t("adminExam.noSubmissions")}</p>}
        <ul className="exam-admin-list">
          {exam.sessions.map((row) => (
            <li key={row.id} className={sessionId === row.id ? "is-open" : ""}>
              <div>
                <strong>{row.studentName}</strong>
                <p className="muted">
                  {sessionLabel(row.status, t)}
                  {row.score ? ` · ${row.score}/${row.maxScore ?? exam.maxScore}` : ""}
                  {Object.entries(row.warnings).map(([kind, count]) => ` · ${t(eventKey(kind))} ${count}`)}
                </p>
              </div>
              <Link className="btn sm" to={`/admin/examinations/${exam.id}/sessions/${row.id}`}>
                {t("common.open")}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {submission && (
        <section className="exam-panel exam-review">
          <header>
            <h3>
              {submission.studentName} · {submission.title}
            </h3>
            <Link to={`/admin/students/${submission.studentId}/record`}>{t("adminExam.openRecord")}</Link>
          </header>
          <div className="exam-review__grid">
            <ol className="exam-sheet">
              {submission.questions.map((q, index) => (
                <li key={q.id}>
                  <p>
                    <strong>
                      {index + 1}. {q.prompt}
                    </strong>
                  </p>
                  <p className="muted">{t("exam.marks", { marks: q.marks })}</p>
                  {q.choice && <p>{t("exam.picked")}: {q.choice}</p>}
                  <p className="exam-answer">{q.response || t("exam.blank")}</p>
                </li>
              ))}
            </ol>
            <aside>
              <h3>{t("adminExam.events")}</h3>
              {submission.events.length === 0 && <p className="muted">{t("adminExam.noEvents")}</p>}
              <ul className="exam-events">
                {submission.events.map((event, index) => (
                  <li key={`${event.kind}-${index}`}>
                    {t(eventKey(event.kind))}
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">{t("adminExam.eventNote")}</p>
              {canWrite && submission.status !== "IN_PROGRESS" && (
                <form className="exam-admin-form" onSubmit={(e) => void saveGrade(e)}>
                  <label>
                    {t("adminExam.score")} / {submission.maxScore}
                    <input className="form-input" value={score} onChange={(e) => setScore(e.target.value)} required maxLength={40} />
                  </label>
                  <label>
                    {t("adminExam.feedback")}
                    <textarea className="form-input" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} />
                  </label>
                  <button className="btn primary" type="submit" disabled={busy}>
                    {t("adminExam.saveGrade")}
                  </button>
                </form>
              )}
              {submission.status === "IN_PROGRESS" && <p className="muted">{t("adminExam.stillWriting")}</p>}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}

function statusLabel(status: ExamDetail["status"], t: (key: MessageKey) => string): string {
  if (status === "PUBLISHED") return t("adminExam.status.PUBLISHED");
  if (status === "CLOSED") return t("adminExam.status.CLOSED");
  return t("adminExam.status.DRAFT");
}

function sessionLabel(status: SessionRow["status"], t: (key: MessageKey) => string): string {
  if (status === "SUBMITTED") return t("adminExam.session.SUBMITTED");
  if (status === "GRADED") return t("adminExam.session.GRADED");
  return t("adminExam.session.IN_PROGRESS");
}

function eventKey(kind: string): "adminExam.event.TAB_LEFT" | "adminExam.event.NOISE" | "adminExam.event.SECOND_VOICE" | "adminExam.event.FACE_LEFT" | "adminExam.event.MOUTH" {
  if (kind === "NOISE") return "adminExam.event.NOISE";
  if (kind === "SECOND_VOICE") return "adminExam.event.SECOND_VOICE";
  if (kind === "FACE_LEFT") return "adminExam.event.FACE_LEFT";
  if (kind === "MOUTH") return "adminExam.event.MOUTH";
  return "adminExam.event.TAB_LEFT";
}
