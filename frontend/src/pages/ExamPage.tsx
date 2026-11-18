import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { apiFetch } from "../lib/authApi";
import { setPageMeta } from "../lib/seo";

type ExamItem = {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  status: "PUBLISHED" | "CLOSED";
  questionCount: number;
  maxScore: string;
  session: {
    id: string;
    status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
    score: string | null;
    maxScore: string | null;
    feedback: string | null;
  } | null;
};

export function ExamPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamItem[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    setPageMeta({ title: t("exam.title"), description: t("exam.lede"), robots: "noindex,nofollow" });
  }, [t]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "ADMIN" || user.role === "READONLY") {
      navigate("/admin/examinations", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user || user.role !== "STUDENT") return;
    apiFetch<{ exams: ExamItem[] }>("/api/student/exams")
      .then((d) => setExams(d.exams))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("common.error")));
  }, [user, t]);

  async function openExam(exam: ExamItem) {
    if (exam.session && exam.session.status !== "IN_PROGRESS") {
      navigate(`/exam/room/${exam.session.id}`);
      return;
    }
    if (exam.session?.status === "IN_PROGRESS") {
      navigate(`/exam/room/${exam.session.id}`);
      return;
    }
    if (exam.status !== "PUBLISHED") return;
    setBusyId(exam.id);
    setError("");
    try {
      const started = await apiFetch<{ sessionId: string }>(`/api/student/exams/${exam.id}/start`, {
        method: "POST",
        body: "{}",
      });
      navigate(`/exam/room/${started.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyId("");
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">{t("common.loading")}</p>
      </section>
    );
  }
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role === "ADMIN" || user.role === "READONLY") return <Navigate to="/admin/examinations" replace />;

  if (exams === null && !error) {
    return (
      <section className="panel">
        <p className="muted">{t("common.loading")}</p>
      </section>
    );
  }

  return (
    <section className="panel studio-page">
      <p className="home-kicker">{t("exam.kicker")}</p>
      <h1>{t("exam.title")}</h1>
      <p className="lede">{t("exam.lede")}</p>
      <ul className="exam-rules">
        <li>{t("exam.ruleTab")}</li>
        <li>{t("exam.ruleFace")}</li>
        <li>{t("exam.ruleNoise")}</li>
        <li>{t("exam.ruleVoice")}</li>
        <li>{t("exam.ruleMouth")}</li>
      </ul>
      {error && <p className="status error">{error}</p>}
      {exams && exams.length === 0 && <p className="muted">{t("exam.empty")}</p>}
      <div className="dashboard-cards">
        {exams?.map((exam) => {
          const session = exam.session;
          const graded = session?.status === "GRADED";
          const waiting = session?.status === "SUBMITTED";
          const live = session?.status === "IN_PROGRESS";
          return (
            <article key={exam.id} className="dashboard-card exam-card">
              <h3>{exam.title}</h3>
              <p>
                {t("exam.duration", { minutes: exam.durationMinutes })} · {exam.questionCount} · {exam.maxScore}
              </p>
              {exam.instructions && <p className="muted">{exam.instructions}</p>}
              {graded && (
                <p>
                  <strong>
                    {t("exam.score")}: {session?.score}/{session?.maxScore || exam.maxScore}
                  </strong>
                </p>
              )}
              {graded && session?.feedback && <p className="muted">{session.feedback}</p>}
              {waiting && <p className="muted">{t("exam.waiting")}</p>}
              {exam.status === "PUBLISHED" || session ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busyId === exam.id}
                  onClick={() => void openExam(exam)}
                >
                  {graded || waiting ? t("exam.view") : live ? t("exam.continue") : t("exam.start")}
                </button>
              ) : (
                <p className="muted">{t("exam.notOpen")}</p>
              )}
            </article>
          );
        })}
      </div>
      <p>
        <Link to="/dashboard">{t("exam.backDash")}</Link>
      </p>
    </section>
  );
}
