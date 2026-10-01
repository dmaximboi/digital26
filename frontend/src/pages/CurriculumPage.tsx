import { useEffect } from "react";
import { Link } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { useT } from "../i18n/LocaleContext";
import {
  CURRICULUM_CUSTOM,
  CURRICULUM_ENROL,
  CURRICULUM_INTRO,
  PROGRAMME_TRACKS,
} from "../lib/curriculum";
import { setPageMeta } from "../lib/seo";

export function CurriculumPage() {
  const t = useT();

  useEffect(() => {
    setPageMeta({
      title: t("curriculum.metaTitle"),
      description: t("curriculum.metaDesc"),
      path: "/curriculum",
    });
  }, [t]);

  return (
    <section className="panel curriculum-page">
      <DocBrandHeader title={t("curriculum.title")} />
      <p className="lede">{CURRICULUM_INTRO.lede}</p>

      <article className="curriculum-paper">
        <h2>{CURRICULUM_INTRO.title}</h2>
        <ul className="curriculum-paper__teach">
          {CURRICULUM_INTRO.howWeTeach.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="curriculum-enrol">{CURRICULUM_ENROL}</p>
      </article>

      {PROGRAMME_TRACKS.map((track) => (
        <article key={track.code} className="curriculum-track" id={track.code.toLowerCase()}>
          <header>
            <p className="eyebrow">
              {track.months} months · {track.weeks} weeks
            </p>
            <h2>{track.title}</h2>
            <p className="lede">{track.pitch}</p>
            <p className="curriculum-pace">{track.pace}</p>
            <p className="muted">{track.mentorship}</p>
          </header>
          <ul className="curriculum-extras">
            {track.extras.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {track.monthsPlan.map((block) => (
            <section key={block.label} className="curriculum-month">
              <h3>{block.label}</h3>
              <p className="curriculum-month__focus">{block.focus}</p>
              <ol className="curriculum-weeks">
                {block.weeks.map((week) => (
                  <li key={week.week} className="curriculum-week">
                    <h4>
                      Week {week.week}: {week.title}
                    </h4>
                    <ul>
                      {week.topics.map((topic) => (
                        <li key={topic}>{topic}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <p className="curriculum-ships">
                <strong>Ships:</strong> {block.ships}
              </p>
            </section>
          ))}
        </article>
      ))}

      <article className="curriculum-track">
        <h2>{t("apply.prog.custom")}</h2>
        <p>{CURRICULUM_CUSTOM}</p>
      </article>

      <div className="cta-row">
        <Link className="btn primary" to="/apply">
          {t("home.applyNow")}
        </Link>
        <Link className="btn" to="/quiz">
          {t("quiz.title")}
        </Link>
      </div>
    </section>
  );
}
