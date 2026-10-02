import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { useT } from "../i18n/LocaleContext";
import {
  loadQuizStore,
  markQuizUsed,
  pickPlay,
  QUIZ_PLAY,
  refreshQuizPack,
  reportQuizAttempt,
  scoreQuiz,
  unusedQuestions,
  type CachedQuestion,
  type QuizResult,
} from "../lib/offlinePack";
import { setPageMeta } from "../lib/seo";

export function QuizPage() {
  const t = useT();
  const [pool, setPool] = useState<CachedQuestion[]>([]);
  const [shown, setShown] = useState<CachedQuestion[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

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
      const cached = loadQuizStore();
      if (cached.questions.length) {
        const first = pickPlay(unusedQuestions(cached).length ? unusedQuestions(cached) : cached.questions);
        setPool(cached.questions);
        setShown(first);
        setLoading(false);
      }

      try {
        const next = await refreshQuizPack(false);
        if (cancelled) return;
        const unused = unusedQuestions(next);
        const ready = unused.length ? unused : next.questions;
        setPool(next.questions);
        setShown((current) => (current.length ? current : pickPlay(ready)));
        if (!next.questions.length) setError(t("quiz.notReady"));
        setLoading(false);
      } catch {
        if (cancelled) return;
        if (!cached.questions.length) setError(t("quiz.offline"));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function shuffleShown() {
    if (result) return;
    if (shown.length) markQuizUsed(shown.map((q) => q.id));
    let unused = unusedQuestions();
    if (unused.length < QUIZ_PLAY && navigator.onLine) {
      try {
        const next = await refreshQuizPack(true);
        setPool(next.questions);
        unused = unusedQuestions(next);
      } catch {
        /* keep local leftover */
      }
    }
    const nextShown = pickPlay(unused.length ? unused : pool);
    setPicks({});
    setShown(nextShown);
  }

  function submit() {
    if (!shown.length || busy) return;
    setBusy(true);
    setError("");
    const answers: Record<string, number> = {};
    for (const q of shown) {
      if (picks[q.id] !== undefined) answers[q.id] = picks[q.id]!;
    }
    const data = scoreQuiz(answers, shown);
    setResult(data);
    markQuizUsed(shown.map((q) => q.id));
    reportQuizAttempt(answers);
    setBusy(false);
  }

  const playSize = Math.min(QUIZ_PLAY, shown.length || QUIZ_PLAY);
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
            onClick={() => void shuffleShown()}
            aria-label={t("quiz.shuffle")}
            title={t("quiz.shuffle")}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-3.1-6.7" />
              <path d="M21 3v6h-6" />
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
              onClick={submit}
            >
              {busy ? t("quiz.scoring") : t("quiz.submit", { n: answered, total: playSize })}
            </button>
          )}
        </>
      )}
    </section>
  );
}
