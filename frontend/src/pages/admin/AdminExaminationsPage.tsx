import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useT } from "../../i18n/LocaleContext";
import type { MessageKey } from "../../i18n/locales/en";
import { apiFetch } from "../../lib/authApi";

type ExamRow = {
  id: string;
  title: string;
  durationMinutes: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  questionCount: number;
  maxScore: string;
  submissions: number;
};

export function AdminExaminationsPage() {
  const t = useT();
  const { user } = useAuth();
  const canWrite = Boolean(user?.canWrite);
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ exams: ExamRow[] }>("/api/ops/examinations")
      .then((d) => setExams(d.exams))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("common.error")));
  }, [t]);

  useEffect(load, [load]);

  async function createExam(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/ops/examinations", {
        method: "POST",
        body: JSON.stringify({
          title,
          instructions,
          durationMinutes: Number(minutes),
        }),
      });
      setTitle("");
      setInstructions("");
      setMinutes("60");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ops-page">
      <div className="ops-page__head">
        <div>
          <p className="home-kicker">{t("adminExam.kicker")}</p>
          <h2>{t("adminExam.title")}</h2>
          <p className="muted">{t("adminExam.lede")}</p>
        </div>
      </div>
      {error && <p className="status error">{error}</p>}
      {canWrite && (
        <form className="exam-admin-form" onSubmit={(e) => void createExam(e)}>
          <label>
            {t("adminExam.name")}
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={120} />
          </label>
          <label>
            {t("adminExam.instructions")}
            <textarea className="form-input" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={4000} />
          </label>
          <label>
            {t("adminExam.minutes")}
            <input className="form-input" type="number" min={10} max={180} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            {t("adminExam.create")}
          </button>
        </form>
      )}
      {!exams && <p className="muted">{t("common.loading")}</p>}
      <ul className="exam-admin-list">
        {exams?.map((exam) => (
          <li key={exam.id}>
            <div>
              <strong>{exam.title}</strong>
              <p className="muted">
                {statusLabel(exam.status, t)} · {exam.durationMinutes} min · {exam.questionCount} · {exam.submissions} {t("adminExam.submissions")}
              </p>
            </div>
            <Link className="btn sm" to={`/admin/examinations/${exam.id}`}>
              {t("common.open")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusLabel(status: ExamRow["status"], t: (key: MessageKey) => string): string {
  if (status === "PUBLISHED") return t("adminExam.status.PUBLISHED");
  if (status === "CLOSED") return t("adminExam.status.CLOSED");
  return t("adminExam.status.DRAFT");
}
