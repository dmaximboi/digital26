import { ensureDailyQuiz, peekDailyQuiz, QUIZ_POOL } from "./dailyQuiz.js";
import { ensureDailyNews, NEWS_DAILY_COUNT, peekDailyNews } from "./techNews.js";

async function fillDailyPack() {
  const { kept } = await peekDailyQuiz();
  if (kept.length < QUIZ_POOL) {
    const quiz = await ensureDailyQuiz();
    console.log(`[daily-pack] quiz pool=${Array.isArray(quiz.questions) ? quiz.questions.length : kept.length}`);
  }
  const news = await peekDailyNews();
  if (news.length < NEWS_DAILY_COUNT) {
    const filled = await ensureDailyNews();
    console.log(`[daily-pack] news count=${filled.length}`);
  }
}

export function startDailyPackCron() {
  const tickMs = 15 * 60 * 1000;
  const run = () => {
    void fillDailyPack().catch((err) => console.warn("[daily-pack]", err));
  };
  setTimeout(run, 25_000);
  const timer = setInterval(run, tickMs);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}
