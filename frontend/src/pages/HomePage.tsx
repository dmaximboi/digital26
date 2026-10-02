import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CodingLaptop } from "../components/CodingLaptop";
import { useT } from "../i18n/LocaleContext";
import { setPageMeta, setJsonLd, orgWebsiteJsonLd } from "../lib/seo";

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden>
      {name}
    </span>
  );
}

export function HomePage() {
  const t = useT();
  const navigate = useNavigate();
  const [verifyMode, setVerifyMode] = useState<"cert" | "agree">("cert");
  const [verifyId, setVerifyId] = useState("");

  useEffect(() => {
    setPageMeta({
      title: t("home.metaTitle"),
      description: t("home.metaDesc"),
      path: "/",
    });
    setJsonLd("d26-jsonld-home", orgWebsiteJsonLd());
  }, [t]);

  function onVerify(e: FormEvent) {
    e.preventDefault();
    const id = verifyId.trim();
    if (!id) {
      navigate(verifyMode === "cert" ? "/verify" : "/check-agreement");
      return;
    }
    navigate(
      verifyMode === "cert" ? `/verify/${encodeURIComponent(id)}` : `/check-agreement/${encodeURIComponent(id)}`,
    );
  }

  const pillars = [
    { icon: "school", title: "home.f1.title", body: "home.f1.body", tag: "home.f1.tag" },
    { icon: "speed", title: "home.f2.title", body: "home.f2.body", tag: "home.f2.tag" },
    { icon: "savings", title: "home.f3.title", body: "home.f3.body", tag: "home.f3.tag" },
    { icon: "qr_code_2", title: "home.f4.title", body: "home.f4.body", tag: "home.f4.tag" },
    { icon: "lock", title: "home.f6.title", body: "home.f6.body", tag: "home.f6.tag" },
    { icon: "layers", title: "home.f5.title", body: "home.f5.body", tag: "home.f5.tag" },
  ] as const;

  const modules = [
    { code: "home.mod1.code", title: "home.mod1.title", body: "home.mod1.body", meta: "home.mod1.meta" },
    { code: "home.mod2.code", title: "home.mod2.title", body: "home.mod2.body", meta: "home.mod2.meta" },
    { code: "home.mod3.code", title: "home.mod3.title", body: "home.mod3.body", meta: "home.mod3.meta" },
    { code: "home.mod4.code", title: "home.mod4.title", body: "home.mod4.body", meta: "home.mod4.meta" },
  ] as const;

  const systems = [
    { icon: "payments", title: "home.sys1.title", body: "home.sys1.body", meta: "home.sys1.meta" },
    { icon: "map", title: "home.sys2.title", body: "home.sys2.body", meta: "home.sys2.meta" },
    { icon: "event_available", title: "home.sys3.title", body: "home.sys3.body", meta: "home.sys3.meta" },
    { icon: "shopping_cart", title: "home.sys4.title", body: "home.sys4.body", meta: "home.sys4.meta" },
  ] as const;

  return (
    <div className="home-page">
      <div className="home-top">
        <div className="home-glow home-glow--top" aria-hidden />

        <section className="home-hero">
        <p className="home-hero__underlay" aria-hidden="true">
          Digital26
        </p>
        <div className="home-hero__headline">
          <p className="home-kicker">{t("home.heroKicker")}</p>
          <h1>
            {t("home.heroTitle")}
            <br />
            <span className="home-hero__accent">{t("home.heroAccent")}</span>
          </h1>
          <div className="home-hero__memphis">
            <CodingLaptop />
          </div>
        </div>
        <p className="lede">{t("home.lede")}</p>
        <div className="cta-row">
          <Link className="btn primary" to="/apply">
            {t("home.applyNow")}
            <Icon name="arrow_forward" />
          </Link>
          <Link className="btn" to="/contact">
            <Icon name="terminal" />
            {t("home.hireStudio")}
          </Link>
          <Link className="btn ghost" to="/verify">
            <Icon name="description" />
            {t("home.verifyTools")}
          </Link>
        </div>

        <div className="home-hero__stage">
          <aside className="home-metrics">
            <div className="home-metrics__head">
              <div>
                <p className="home-kicker">{t("home.metricsKicker")}</p>
                <h2>{t("home.metricsTitle")}</h2>
              </div>
              <span className="home-icon-tile">
                <Icon name="verified" />
              </span>
            </div>
            <p className="home-metrics__label">
              {t("home.chartLabel")}
              <strong>{t("home.chartSpeed")}</strong>
            </p>
            <div className="home-bars" aria-hidden>
              <div className="home-bars__row">
                <span className="home-bars__fill home-bars__fill--muted" style={{ width: "28%" }} />
                <span>{t("home.chartFreelance")}</span>
              </div>
              <div className="home-bars__row">
                <span className="home-bars__fill home-bars__fill--gold" style={{ width: "92%" }} />
                <span className="home-bars__on-gold">{t("home.chartUs")}</span>
              </div>
            </div>
            <div className="home-metrics__stats">
              <div>
                <span>{t("home.metricCost")}</span>
                <strong>{t("home.metricCostVal")}</strong>
              </div>
              <div>
                <span>{t("home.metricIntegrity")}</span>
                <strong className="is-cyan">{t("home.metricIntegrityVal")}</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="home-trust">
        <span>
          <Icon name="verified" /> {t("home.rc")}
        </span>
        <span>
          <Icon name="security" /> {t("home.trustOauth")}
        </span>
        <span>
          <Icon name="architecture" /> {t("home.trustSystems")}
        </span>
        <span>
          <Icon name="public" /> {t("home.trustWorld")}
        </span>
      </div>

      <section className="home-section" id="studio-solutions">
        <header className="home-section__head">
          <div>
            <p className="home-kicker">{t("home.pillarsKicker")}</p>
            <h2>{t("home.whatIs")}</h2>
          </div>
          <p>{t("home.pillarsLede")}</p>
        </header>
        <div className="home-bento">
          {pillars.map((item) => (
            <article className="home-card" key={item.title}>
              <span className="home-icon-tile">
                <Icon name={item.icon} />
              </span>
              <h3>{t(item.title)}</h3>
              <p>{t(item.body)}</p>
              <span className="home-card__tag">{t(item.tag)}</span>
            </article>
          ))}
        </div>
      </section>
      </div>

      <div className="home-glow home-glow--mid" aria-hidden />

      <section className="home-verify" id="verification-console">
        <div className="home-verify__copy">
          <p className="home-kicker home-kicker--cyan">
            <span className="home-dot" />
            {t("home.verifyKicker")}
          </p>
          <h2>{t("home.verifyTitle")}</h2>
          <p>{t("home.verifyBody")}</p>
          <ul>
            <li>
              <Icon name="check_circle" /> {t("home.verifyPoint1")}
            </li>
            <li>
              <Icon name="check_circle" /> {t("home.verifyPoint2")}
            </li>
            <li>
              <Icon name="check_circle" /> {t("home.verifyPoint3")}
            </li>
          </ul>
        </div>
        <form className="home-console" onSubmit={onVerify}>
          <div className="home-console__tabs">
            <button
              type="button"
              className={verifyMode === "cert" ? "is-active" : ""}
              onClick={() => setVerifyMode("cert")}
            >
              {t("home.verifyCert")}
            </button>
            <button
              type="button"
              className={verifyMode === "agree" ? "is-active" : ""}
              onClick={() => setVerifyMode("agree")}
            >
              {t("home.checkAgreement")}
            </button>
          </div>
          <div className="home-console__row">
            <input
              value={verifyId}
              onChange={(e) => setVerifyId(e.target.value)}
              placeholder={t("home.verifyPlaceholder")}
              aria-label={t("home.verifyPlaceholder")}
            />
            <button className="btn primary" type="submit">
              {t("home.verifyAction")}
            </button>
          </div>
          <p className="home-console__hint">{t("home.verifyHint")}</p>
        </form>
      </section>

      <section className="home-section" id="training">
        <header className="home-section__head">
          <div>
            <p className="home-kicker">{t("home.trainKicker")}</p>
            <h2>{t("home.f5.title")}</h2>
          </div>
          <p className="home-chip">{t("home.trainOnline")}</p>
        </header>
        <div className="home-modules">
          {modules.map((mod) => (
            <article className="home-card home-card--mod" key={mod.code}>
              <span className="home-mod-code">{t(mod.code)}</span>
              <h3>{t(mod.title)}</h3>
              <p>{t(mod.body)}</p>
              <span className="home-mod-meta">{t(mod.meta)}</span>
            </article>
          ))}
        </div>
        <div className="home-ribbon">
          <div>
            <span className="home-icon-tile home-icon-tile--gold">
              <Icon name="calendar_month" />
            </span>
            <div>
              <h3>{t("home.trainRibbonTitle")}</h3>
              <p>{t("home.trainRibbonBody")}</p>
            </div>
          </div>
          <Link className="btn" to="/curriculum">
            {t("home.curriculum")}
          </Link>
        </div>
      </section>

      <section className="home-systems">
        <div className="home-systems__head">
          <div>
            <p className="home-kicker">{t("home.systemsKicker")}</p>
            <h2>{t("home.systemsTitle")}</h2>
            <p>{t("home.systemsBody")}</p>
          </div>
          <div className="home-systems__cta">
            <strong>{t("home.systemsCount")}</strong>
            <span>{t("home.systemsCountHint")}</span>
            <Link className="btn primary" to="/contact">
              {t("home.requestSystem")}
            </Link>
          </div>
        </div>
        <div className="home-systems__grid">
          {systems.map((sys) => (
            <article key={sys.title}>
              <Icon name={sys.icon} />
              <h3>{t(sys.title)}</h3>
              <p>{t(sys.body)}</p>
              <span>{t(sys.meta)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta-bottom" id="cta-banner">
        <p className="home-pill home-pill--center">
          <Icon name="verified_user" />
          {t("home.ctaKicker")}
        </p>
        <h2>{t("home.ready")}</h2>
        <p>{t("home.readyBody")}</p>
        <div className="cta-row cta-row--center">
          <Link className="btn primary" to="/signin">
            <Icon name="lock_open" />
            {t("home.signInGoogle")}
          </Link>
          <Link className="btn" to="/contact">
            {t("home.hireUs")}
          </Link>
          <Link className="btn ghost" to="/about">
            {t("home.learnMore")}
          </Link>
        </div>
        <p className="home-cta-meta">
          {t("home.ctaMeta")}
          <span>{t("home.rc")}</span>
          <span>digital26.online</span>
        </p>
      </section>
    </div>
  );
}
