import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { useT } from "../i18n/LocaleContext";
import { apiGet, apiPost } from "../lib/api";
import { setPageMeta } from "../lib/seo";

type Question = { id: string; prompt: string; choices: string[] };

type TodayQuiz = {
  ready?: boolean;
  quizDate: string;
  playSize: number;
  poolSize: number;
  questions: Question[];
};

type Result = {
  score: number;
  total: number;
  breakdown: Array<{ id: string; correct: boolean; answerIndex: number; yourIndex: number | null }>;
};

const VISITOR_KEY = "d26_quiz_visitor";

function visitorKey(): string {
  try {
    const existing = sessionStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch {
    return `anon-${Date.now()}`;
  }
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function pickPlay(pool: Question[], n: number): Question[] {
  return shuffle(pool).slice(0, Math.min(n, pool.length));
}

export function QuizPage() {
  const t = useT();
  const [pool, setPool] = useState<Question[]>([]);
  const [playSize, setPlaySize] = useState(10);
  const [shown, setShown] = useState<Question[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    setPageMeta({
      title: t("quiz.metaTitle"),
      description: t("quiz.metaDesc"),
      path: "/quiz",
    });
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiGet<TodayQuiz>("/api/public/quiz/today");
        if (cancelled) return;
        if (data.ready === false || !data.questions?.length) {
          setError(t("quiz.notReady"));
          setLoading(false);
          return;
        }
        const n = data.playSize || 10;
        setPlaySize(n);
        setPool(data.questions);
        setShown(pickPlay(data.questions, n));
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("common.error"));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  function shuffleShown() {
    if (result) return;
    setPicks({});
    setShown(pickPlay(pool, playSize));
  }

  async function submit() {
    if (!shown.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const answers: Record<string, number> = {};
      for (const q of shown) {
        if (picks[q.id] !== undefined) answers[q.id] = picks[q.id]!;
      }
      const data = await apiPost<Result>("/api/public/quiz/today/submit", {
        visitorKey: visitorKey(),
        answers,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const answered = shown.filter((q) => picks[q.id] !== undefined).length;

  return (
    <section className="panel quiz-page">
      <div className="quiz-toolbar">
        <DocBrandHeader title={t("quiz.title")} />
        {shown.length > 0 && (
          <button
            className="btn quiz-shuffle"
            type="button"
            disabled={Boolean(result) || pool.length < 2}
            onClick={shuffleShown}
            aria-label={t("quiz.shuffle")}
            title={t("quiz.shuffle")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M16 3h5v5" />
              <path d="m21 3-8 8" />
              <path d="M4 20 10 14" />
              <path d="M16 21h5v-5" />
              <path d="m21 21-6-6" />
              <path d="M4 4 8 8" />
            </svg>
          </button>
        )}
      </div>

      {loading && (
        <div className="quiz-wait" role="status">
          <span className="quiz-wait__bar" />
          <p>{t("common.loading")}</p>
        </div>
      )}
      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      {shown.length > 0 && (
        <>
          <ol className="quiz-list">
            {shown.map((q, index) => {
              const row = result?.breakdown.find((b) => b.id === q.id);
              return (
                <li key={q.id} className="quiz-card">
                  <p>
                    <span className="quiz-card__n">{index + 1}.</span> {q.prompt}
                  </p>
                  <div className="quiz-choices" role="radiogroup" aria-label={q.prompt}>
                    {q.choices.map((choice, i) => {
                      const selected = picks[q.id] === i;
                      const show = Boolean(result);
                      const isCorrect = row?.answerIndex === i;
                      const isWrongPick = show && selected && !row?.correct;
                      return (
                        <label
                          key={`${q.id}-${i}`}
                          className={`quiz-choice${selected ? " is-selected" : ""}${
                            show && isCorrect ? " is-right" : ""
                          }${isWrongPick ? " is-wrong" : ""}`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={selected}
                            disabled={Boolean(result)}
                            onChange={() => setPicks((prev) => ({ ...prev, [q.id]: i }))}
                          />
                          <span>{choice}</span>
                        </label>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>

          {result ? (
            <div className="quiz-score">
              <p>
                {t("quiz.score", { score: result.score, total: result.total })}
              </p>
              <Link className="btn" to="/curriculum">
                {t("curriculum.title")}
              </Link>
            </div>
          ) : (
            <button
              className="btn primary"
              type="button"
              disabled={busy || answered < playSize}
              onClick={() => void submit()}
            >
              {busy ? t("quiz.scoring") : t("quiz.submit", { n: answered, total: playSize })}
            </button>
          )}
        </>
      )}
    </section>
  );
}
