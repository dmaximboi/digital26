import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getToken, useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { apiFetch } from "../lib/authApi";
import { openExamMedia, watchExam, type ExamWarning } from "../lib/examWatch";
import { setPageMeta } from "../lib/seo";

type Question = { id: string; prompt: string; marks: number; response: string };
type SessionView = {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  title: string;
  instructions: string | null;
  deadlineAt: string;
  score: string | null;
  maxScore: string | null;
  feedback: string | null;
  warningCount: number;
  questions: Question[];
};

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

export function ExamRoomPage() {
  const t = useT();
  const { sessionId = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skipLeave = useRef(false);
  const done = useRef(false);
  const [session, setSession] = useState<SessionView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [armed, setArmed] = useState(false);
  const [faceOn, setFaceOn] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState(false);
  const [mediaTry, setMediaTry] = useState(0);

  useEffect(() => {
    setPageMeta({ title: t("exam.title"), description: t("exam.leaveWarning"), robots: "noindex,nofollow" });
  }, [t]);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user || !sessionId) return;
    let cancelled = false;
    apiFetch<{ session: SessionView }>(`/api/student/exams/sessions/${sessionId}`)
      .then((d) => {
        if (cancelled) return;
        setSession(d.session);
        const next: Record<string, string> = {};
        for (const q of d.session.questions) next[q.id] = q.response;
        setAnswers(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("common.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [user, sessionId, t]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS" || !armed) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session, armed]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS") return;
    let stream: MediaStream | null = null;
    let stopWatch = () => {};
    let cancelled = false;

    openExamMedia()
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        const video = videoRef.current;
        if (video) {
          video.srcObject = next;
          void video.play().catch(() => {});
        }
        const watch = watchExam({
          stream: next,
          video: video ?? document.createElement("video"),
          onWarning(kind) {
            setNotice(t(warningKey(kind)));
            void apiFetch(`/api/student/exams/sessions/${session.id}/events`, {
              method: "POST",
              body: JSON.stringify({ kind }),
            }).catch(() => {});
          },
        });
        setFaceOn(watch.faceSupported);
        stopWatch = watch.stop;
        setArmed(true);
        setMediaError("");
      })
      .catch(() => {
        if (!cancelled) setMediaError(t("exam.needCamera"));
      });

    return () => {
      cancelled = true;
      stopWatch();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [session?.id, session?.status, mediaTry, t]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS") return;
    const mark = Symbol(session.id);
    const holder = window as unknown as { __examRoom?: symbol };
    holder.__examRoom = mark;

    const handIn = (reason: "TAB_LEFT" | "DEADLINE") => {
      if (done.current || skipLeave.current) return;
      done.current = true;
      const token = getToken();
      void fetch(`${API_BASE}/api/student/exams/sessions/${session.id}/submit`, {
        method: "POST",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });
      setSession((current) => (current ? { ...current, status: "SUBMITTED" } : current));
      setNotice(reason === "DEADLINE" ? t("exam.handedInTime") : t("exam.handedInTab"));
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") handIn("TAB_LEFT");
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      window.setTimeout(() => {
        if (holder.__examRoom === mark) handIn("TAB_LEFT");
      }, 0);
    };
  }, [session?.id, session?.status, t]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS" || !armed) return;
    const left = new Date(session.deadlineAt).getTime() - now;
    if (left <= 0 && !done.current) {
      skipLeave.current = true;
      done.current = true;
      void apiFetch(`/api/student/exams/sessions/${session.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ reason: "DEADLINE" }),
      }).finally(() => {
        setSession((current) => (current ? { ...current, status: "SUBMITTED" } : current));
        setNotice(t("exam.handedInTime"));
      });
    }
  }, [now, session, armed, t]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS" || !armed) return;
    const handle = window.setTimeout(() => {
      const payload = session.questions.map((q) => ({
        questionId: q.id,
        response: answers[q.id] ?? "",
      }));
      void apiFetch(`/api/student/exams/sessions/${session.id}/answers`, {
        method: "PUT",
        body: JSON.stringify({ answers: payload }),
      })
        .then(() => setSaved(true))
        .catch(() => setSaved(false));
    }, 800);
    return () => window.clearTimeout(handle);
  }, [answers, session, armed]);

  async function submitNow() {
    if (!session || done.current) return;
    skipLeave.current = true;
    done.current = true;
    setError("");
    try {
      const payload = session.questions.map((q) => ({
        questionId: q.id,
        response: answers[q.id] ?? "",
      }));
      await apiFetch(`/api/student/exams/sessions/${session.id}/answers`, {
        method: "PUT",
        body: JSON.stringify({ answers: payload }),
      });
      await apiFetch(`/api/student/exams/sessions/${session.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ reason: "STUDENT" }),
      });
      const fresh = await apiFetch<{ session: SessionView }>(`/api/student/exams/sessions/${session.id}`);
      setSession(fresh.session);
      setNotice(t("exam.handedIn"));
    } catch (err) {
      done.current = false;
      skipLeave.current = false;
      setError(err instanceof Error ? err.message : t("common.error"));
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

  if (!session && !error) {
    return (
      <section className="panel">
        <p className="muted">{t("common.loading")}</p>
      </section>
    );
  }
  if (!session) {
    return (
      <section className="panel">
        <p className="status error">{error}</p>
      </section>
    );
  }

  const live = session.status === "IN_PROGRESS";
  const msLeft = new Date(session.deadlineAt).getTime() - now;
  const minutes = Math.max(0, Math.floor(msLeft / 60000));
  const seconds = Math.max(0, Math.floor((msLeft % 60000) / 1000));

  return (
    <section className="panel studio-page exam-room">
      <p className="home-kicker">{t("exam.kicker")}</p>
      <h1>{session.title}</h1>
      {live && <p className="exam-leave">{t("exam.leaveWarning")}</p>}
      {session.instructions && <p className="lede">{session.instructions}</p>}
      {live && (
        <p className="exam-timer">
          {t("exam.timeLeft")}: {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          {saved ? ` · ${t("exam.saved")}` : ""}
        </p>
      )}
      {notice && <p className="status">{notice}</p>}
      {error && <p className="status error">{error}</p>}
      {live && (
        <div className="exam-cam">
          <video ref={videoRef} muted playsInline autoPlay />
          {mediaError && (
            <div>
              <p className="status error">{mediaError}</p>
              <button type="button" className="btn" onClick={() => setMediaTry((n) => n + 1)}>
                {t("exam.cameraRetry")}
              </button>
            </div>
          )}
          {armed && !faceOn && <p className="muted">{t("exam.faceMissing")}</p>}
        </div>
      )}
      {!live && (
        <div className="exam-result">
          <p>
            {session.status === "GRADED"
              ? `${t("exam.score")}: ${session.score}/${session.maxScore ?? ""}`
              : t("exam.waiting")}
          </p>
          {session.feedback && <p>{session.feedback}</p>}
          <p className="muted">{t("exam.warningNote", { count: session.warningCount })}</p>
        </div>
      )}
      <ol className="exam-questions">
        {session.questions.map((q, index) => (
          <li key={q.id}>
            <p>
              <strong>
                {index + 1}. {q.prompt}
              </strong>
            </p>
            <p className="muted">{t("exam.marks", { marks: q.marks })}</p>
            {live ? (
              <textarea
                className="form-input"
                rows={4}
                maxLength={4000}
                value={answers[q.id] ?? ""}
                disabled={!armed}
                onChange={(e) => setAnswers((current) => ({ ...current, [q.id]: e.target.value }))}
              />
            ) : (
              <p className="exam-answer">{answers[q.id] || q.response || t("exam.blank")}</p>
            )}
          </li>
        ))}
      </ol>
      {live && (
        <button type="button" className="btn primary" disabled={!armed || done.current} onClick={() => void submitNow()}>
          {t("exam.submit")}
        </button>
      )}
      {!live && (
        <button type="button" className="btn" onClick={() => navigate("/exam")}>
          {t("exam.backList")}
        </button>
      )}
    </section>
  );
}

function warningKey(kind: ExamWarning): "exam.warnNoise" | "exam.warnVoice" | "exam.warnFace" | "exam.warnMouth" {
  if (kind === "NOISE") return "exam.warnNoise";
  if (kind === "SECOND_VOICE") return "exam.warnVoice";
  if (kind === "FACE_LEFT") return "exam.warnFace";
  return "exam.warnMouth";
}
