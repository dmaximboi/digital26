import { useEffect, useRef, useState, type RefObject } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getToken, useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import { apiFetch } from "../lib/authApi";
import { openExamMedia, watchExam, type ExamFace, type ExamPulse, type ExamWarning } from "../lib/examWatch";
import { setPageMeta } from "../lib/seo";

type Question = {
  id: string;
  prompt: string;
  marks: number;
  response: string;
  choices?: string[];
  choice?: string;
};
type SessionView = {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  title: string;
  instructions: string | null;
  durationMinutes: number;
  deadlineAt: string;
  score: string | null;
  maxScore: string | null;
  feedback: string | null;
  warningCount: number;
  questions: Question[];
};

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

type Phase = "scan" | "brief" | "paper";

type Hud = ExamPulse;

export function ExamRoomPage() {
  const t = useT();
  const { sessionId = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipRef = useRef<HTMLVideoElement | null>(null);
  const skipLeave = useRef(false);
  const done = useRef(false);
  const armedRef = useRef(false);
  const [session, setSession] = useState<SessionView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [faceAway, setFaceAway] = useState(false);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [armed, setArmed] = useState(false);
  armedRef.current = armed;
  const [faceOn, setFaceOn] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState(false);
  const [mediaTry, setMediaTry] = useState(0);
  const [phase, setPhase] = useState<Phase>("scan");
  const [faceLocked, setFaceLocked] = useState(false);
  const [alerts, setAlerts] = useState(0);
  const hudRef = useRef<Hud>({ level: 0, bars: Array(24).fill(0.05), face: null });

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
        const picked: Record<string, string> = {};
        for (const q of d.session.questions) {
          next[q.id] = q.response;
          picked[q.id] = q.choice ?? "";
        }
        setAnswers(next);
        setPicks(picked);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("common.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [user, sessionId, t]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session]);

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
        const pip = pipRef.current;
        for (const node of [video, pip]) {
          if (!node) continue;
          node.srcObject = next;
          void node.play().catch(() => {});
        }
        const watch = watchExam({
          stream: next,
          video: video ?? document.createElement("video"),
          onPulse(pulse) {
            hudRef.current = pulse;
            if (pulse.face) setFaceLocked(true);
          },
          onFaceReady(supported) {
            setFaceOn(supported);
          },
          onWarning(kind) {
            setAlerts((count) => count + 1);
            setNotice(t(warningKey(kind)));
            void apiFetch(`/api/student/exams/sessions/${session.id}/events`, {
              method: "POST",
              body: JSON.stringify({ kind }),
            }).catch(() => {});
          },
        });
        stopWatch = watch.stop;
        setPhase("scan");
        setFaceLocked(false);
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
    if (!armed || phase !== "scan") return;
    if (faceLocked) {
      const id = window.setTimeout(() => setPhase("brief"), 1700);
      return () => window.clearTimeout(id);
    }
    const wait = faceOn ? 8000 : 2800;
    const id = window.setTimeout(() => setPhase("brief"), wait);
    return () => window.clearTimeout(id);
  }, [armed, faceLocked, faceOn, phase]);

  useEffect(() => {
    if (phase !== "brief") return;
    const id = window.setTimeout(() => setPhase("paper"), 8000);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (!armed || !faceOn) {
      setFaceAway(false);
      return;
    }
    const id = window.setInterval(() => {
      setFaceAway(!hudRef.current?.face);
    }, 400);
    return () => window.clearInterval(id);
  }, [armed, faceOn, hudRef]);

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
    let leaveTimer = 0;
    const onBlur = () => {
      window.setTimeout(() => {
        if (!armedRef.current || document.hasFocus()) return;
        handIn("TAB_LEFT");
      }, 200);
    };
    const onOut = (event: MouseEvent) => {
      if (!armedRef.current) return;
      const nextNode = event.relatedTarget;
      if (nextNode instanceof Node && document.documentElement.contains(nextNode)) return;
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => handIn("TAB_LEFT"), 500);
    };
    const onOver = (event: MouseEvent) => {
      if (event.target instanceof Node && document.documentElement.contains(event.target)) {
        window.clearTimeout(leaveTimer);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onBlur);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("mouseover", onOver);

    return () => {
      window.clearTimeout(leaveTimer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseover", onOver);
      window.setTimeout(() => {
        if (holder.__examRoom === mark) handIn("TAB_LEFT");
      }, 0);
    };
  }, [session?.id, session?.status, t]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS") return;
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
  }, [now, session, t]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS" || !armed) return;
    const handle = window.setTimeout(() => {
      const payload = session.questions.map((q) => ({
        questionId: q.id,
        response: answers[q.id] ?? "",
        choice: picks[q.id] ?? "",
      }));
      void apiFetch(`/api/student/exams/sessions/${session.id}/answers`, {
        method: "PUT",
        body: JSON.stringify({ answers: payload }),
      })
        .then(() => setSaved(true))
        .catch(() => setSaved(false));
    }, 800);
    return () => window.clearTimeout(handle);
  }, [answers, picks, session, armed]);

  async function submitNow() {
    if (!session || done.current) return;
    skipLeave.current = true;
    done.current = true;
    setError("");
    try {
      const payload = session.questions.map((q) => ({
        questionId: q.id,
        response: answers[q.id] ?? "",
        choice: picks[q.id] ?? "",
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

  if (live) {
    return (
      <VisorStage
        videoRef={videoRef}
        pipRef={pipRef}
        hudRef={hudRef}
        title={session.title}
        name={user.name || user.email}
        studentId={user.id}
        alerts={alerts}
        durationMinutes={session.durationMinutes}
        instructions={session.instructions}
        questions={session.questions}
        answers={answers}
        picks={picks}
        onAnswer={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
        onPick={(id, value) => setPicks((current) => ({ ...current, [id]: value }))}
        faceAway={faceAway}
        phase={phase}
        faceLocked={faceLocked}
        faceOn={faceOn}
        armed={armed}
        minutes={minutes}
        seconds={seconds}
        low={msLeft < 60_000}
        saved={saved}
        notice={notice}
        error={error}
        mediaError={mediaError}
        onRetry={() => setMediaTry((n) => n + 1)}
        onBegin={() => setPhase("paper")}
        onSubmit={() => void submitNow()}
        submitDisabled={!armed || done.current}
        t={t}
      />
    );
  }

  return (
    <section className="panel studio-page exam-room">
      <p className="home-kicker">{t("exam.kicker")}</p>
      <h1>{session.title}</h1>
      {error && <p className="status error">{error}</p>}
      <article className="exam-result">
        <p className="exam-offer__state">{session.status === "GRADED" ? t("exam.graded") : t("exam.waiting")}</p>
        <p>
          {session.status === "GRADED"
            ? `${t("exam.score")}: ${session.score}/${session.maxScore ?? ""}`
            : t("exam.waiting")}
        </p>
        {session.feedback && <p>{session.feedback}</p>}
        <p className="muted">{t("exam.closedPaper")}</p>
        <p className="muted">{t("exam.warningNote", { count: session.warningCount })}</p>
        <button type="button" className="btn" onClick={() => navigate("/exam")}>
          {t("exam.backList")}
        </button>
      </article>
    </section>
  );
}

function VisorStage(props: {
  videoRef: RefObject<HTMLVideoElement | null>;
  pipRef: RefObject<HTMLVideoElement | null>;
  hudRef: RefObject<Hud>;
  title: string;
  name: string;
  studentId: string;
  alerts: number;
  durationMinutes: number;
  instructions: string | null;
  questions: Question[];
  answers: Record<string, string>;
  picks: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  onPick: (id: string, value: string) => void;
  faceAway: boolean;
  phase: Phase;
  faceLocked: boolean;
  faceOn: boolean;
  armed: boolean;
  minutes: number;
  seconds: number;
  low: boolean;
  saved: boolean;
  notice: string;
  error: string;
  mediaError: string;
  onRetry: () => void;
  onBegin: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  t: ReturnType<typeof useT>;
}) {
  const { t } = props;
  const [index, setIndex] = useState(0);
  const question = props.questions[index];
  const last = props.questions.length - 1;
  const totalMs = Math.max(props.durationMinutes, 1) * 60_000;
  const leftMs = (props.minutes * 60 + props.seconds) * 1000;
  const remainPct = Math.max(0, Math.min(100, (leftMs / totalMs) * 100));
  const rules = [
    t("exam.ruleFace"),
    t("exam.ruleNoise"),
    t("exam.ruleTab"),
    t("exam.ruleVoice"),
    t("exam.ruleMouth"),
  ];

  return (
    <section className={`board ${props.notice ? "is-alert" : ""}`}>
      <header className="board-top">
        <p className="board-brand"><strong>D26</strong> Digital26</p>
        <div>
          <p className="board-kicker">D26</p>
          <h1>{props.title}</h1>
        </div>
        <p className="board-motto">{t("exam.motto")}</p>
      </header>
      <div className="board-body">
        <aside className="board-card">
          <div className="board-student">
            <span className="board-avatar" aria-hidden="true" />
            <p>{t("exam.studentName")}</p>
            <strong>{props.name}</strong>
            <p>{t("exam.studentId")}</p>
            <strong>{props.studentId.slice(-10)}</strong>
          </div>
          <div>
            <h2>{t("exam.rulesTitle")}</h2>
            <ul>
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <p className={`board-face ${props.faceLocked ? "is-ok" : ""}`}>
            <strong>{props.faceLocked ? t("exam.faceOk") : t("exam.scanning")}</strong>
            <span>{props.faceOn ? t("exam.faceLocked") : t("exam.faceMissing")}</span>
          </p>
        </aside>
        <div className="board-stage">
          <video ref={props.videoRef} className="board-video" muted playsInline autoPlay />
          <FaceLock hudRef={props.hudRef} />
          <p className="board-live">{props.armed ? t("exam.live") : t("exam.scanning")}</p>
          <p className={`board-quiet ${props.notice || props.faceAway ? "is-bad" : ""}`}>
            {props.faceAway ? t("exam.warnFace") : props.notice || t("exam.noNoise")}
          </p>
          {props.faceAway && <p className="board-face-alert">{t("exam.warnFace")}</p>}
          {props.phase !== "paper" && (
            <div className="board-question">
              <p className="board-qcount">{props.faceLocked ? t("exam.faceOk") : t("exam.scanning")}</p>
              <h2>{t("exam.prepared", { name: props.name })}</h2>
              {props.instructions && <p>{props.instructions}</p>}
              {props.mediaError && <p>{props.mediaError}</p>}
              {props.phase === "brief" && (
                <button type="button" className="board-next" onClick={props.onBegin}>
                  {t("exam.begin")}
                </button>
              )}
              {props.mediaError && (
                <button type="button" className="board-next" onClick={props.onRetry}>
                  {t("exam.cameraRetry")}
                </button>
              )}
            </div>
          )}
          {props.phase === "paper" && question && (
            <div className="board-question">
              <p className="board-qcount">
                {t("exam.questionOf", { n: index + 1, total: props.questions.length })}
                <span> {t("exam.marks", { marks: question.marks })}</span>
              </p>
              <h2>{question.prompt}</h2>
              {(question.choices ?? []).length > 0 && (
                <div className="board-picks">
                  {(question.choices ?? []).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      className={props.picks[question.id] === choice ? "is-on" : ""}
                      onClick={() => props.onPick(question.id, props.picks[question.id] === choice ? "" : choice)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                rows={3}
                maxLength={4000}
                value={props.answers[question.id] ?? ""}
                disabled={!props.armed}
                placeholder={t("exam.writeHere")}
                onChange={(e) => props.onAnswer(question.id, e.target.value)}
              />
              <div className="board-nav">
                <button type="button" disabled={index === 0} onClick={() => setIndex((n) => Math.max(0, n - 1))}>
                  {t("exam.prev")}
                </button>
                {index < last ? (
                  <button type="button" className="board-next" onClick={() => setIndex((n) => Math.min(last, n + 1))}>
                    {t("exam.next")}
                  </button>
                ) : (
                  <button type="button" className="board-next" disabled={props.submitDisabled} onClick={props.onSubmit}>
                    {t("exam.submit")}
                  </button>
                )}
              </div>
              {props.saved && <p className="board-saved">{t("exam.saved")}</p>}
            </div>
          )}
          {props.error && <p className="board-quiet is-bad">{props.error}</p>}
        </div>
        <aside className="board-card board-meters">
          <div className={props.low ? "is-low" : ""}>
            <p>{t("exam.timeRemaining")}</p>
            <strong className="board-clock">
              {String(props.minutes).padStart(2, "0")}:{String(props.seconds).padStart(2, "0")}
            </strong>
            <span className="board-bar"><i style={{ width: `${remainPct}%` }} /></span>
          </div>
          <div>
            <p>{t("exam.statusLabel")}</p>
            <strong>{t("exam.inProgress")}</strong>
          </div>
          <div>
            <p>{t("exam.alerts")}</p>
            <strong>{props.alerts}</strong>
          </div>
          <div className="board-pip">
            <p>{t("exam.liveMonitor")}</p>
            <video ref={props.pipRef} muted playsInline autoPlay />
          </div>
          <NoiseMeter hudRef={props.hudRef} label={t("exam.noiseLevel")} lowLabel={t("exam.levelLow")} highLabel={t("exam.levelHigh")} />
        </aside>
      </div>
      <footer className="board-foot">
        <span>{t("exam.roomFooter")}</span>
        <span>{t("exam.tagline")}</span>
      </footer>
    </section>
  );
}

function FaceLock(props: { hudRef: RefObject<Hud> }) {
  const { hudRef } = props;
  const [face, setFace] = useState<ExamFace | null>(null);
  useEffect(() => {
    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      if (now - last > 80) {
        last = now;
        setFace(hudRef.current?.face ?? null);
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [hudRef]);
  if (!face) return null;
  return (
    <div
      className="board-lock"
      style={{
        left: `${(1 - face.x - face.w) * 100}%`,
        top: `${face.y * 100}%`,
        width: `${face.w * 100}%`,
        height: `${face.h * 100}%`,
      }}
    />
  );
}

function NoiseMeter(props: { hudRef: RefObject<Hud>; label: string; lowLabel: string; highLabel: string }) {
  const { hudRef } = props;
  const [bars, setBars] = useState<number[]>(() => Array(12).fill(0.08));
  const [level, setLevel] = useState(0);
  useEffect(() => {
    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      if (now - last > 80) {
        last = now;
        const hud = hudRef.current;
        if (hud) {
          setBars(hud.bars.slice(0, 12));
          setLevel(hud.level);
        }
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [hudRef]);
  const loud = level > 0.18;
  return (
    <div className={loud ? "is-loud" : ""}>
      <p>{props.label}</p>
      <div className="board-wave" aria-hidden="true">
        {bars.map((bar, i) => (
          <i key={i} style={{ height: `${Math.max(12, Math.round(bar * 100))}%` }} />
        ))}
      </div>
      <span>{loud ? props.highLabel : props.lowLabel}</span>
    </div>
  );
}

function warningKey(kind: ExamWarning): "exam.warnNoise" | "exam.warnVoice" | "exam.warnFace" | "exam.warnMouth" {
  if (kind === "NOISE") return "exam.warnNoise";
  if (kind === "SECOND_VOICE") return "exam.warnVoice";
  if (kind === "FACE_LEFT") return "exam.warnFace";
  return "exam.warnMouth";
}
