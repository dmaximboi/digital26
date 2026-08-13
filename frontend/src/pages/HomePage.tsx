import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { CodingLaptop } from "../components/CodingLaptop";
import { useT } from "../i18n/LocaleContext";
import { setPageMeta, setJsonLd, orgWebsiteJsonLd } from "../lib/seo";

export function HomePage() {
  const t = useT();

  useEffect(() => {
    setPageMeta({
      title: t("home.metaTitle"),
      description: t("home.metaDesc"),
      path: "/",
    });
    setJsonLd("d26-jsonld-home", orgWebsiteJsonLd());
  }, [t]);

  return (
    <>
      <section className="hero">
        <CodingLaptop />
        <div className="hero-brand">
          <BrandMark size="lg" showText />
        </div>
        <h1>{t("common.brand")}</h1>
        <p className="lede">{t("home.lede")}</p>
        <div className="cta-row">
          <Link className="btn primary" to="/apply">
            {t("home.applyNow")}
          </Link>
          <Link className="btn" to="/verify">
            {t("home.verifyCert")}
          </Link>
          <Link className="btn" to="/check-agreement">
            {t("home.checkAgreement")}
          </Link>
          <Link className="btn" to="/contact">
            {t("home.contactUs")}
          </Link>
        </div>
      </section>

      <section className="home-about">
        <h2>{t("home.whatIs")}</h2>
        <div className="home-about__grid">
          <article className="home-feature">
            <h3>{t("home.f1.title")}</h3>
            <p>{t("home.f1.body")}</p>
          </article>
          <article className="home-feature">
            <h3>{t("home.f2.title")}</h3>
            <p>{t("home.f2.body")}</p>
          </article>
          <article className="home-feature">
            <h3>{t("home.f3.title")}</h3>
            <p>{t("home.f3.body")}</p>
          </article>
          <article className="home-feature">
            <h3>{t("home.f4.title")}</h3>
            <p>{t("home.f4.body")}</p>
          </article>
          <article className="home-feature">
            <h3>{t("home.f5.title")}</h3>
            <p>{t("home.f5.body")}</p>
          </article>
          <article className="home-feature">
            <h3>{t("home.f6.title")}</h3>
            <p>{t("home.f6.body")}</p>
          </article>
        </div>
      </section>

      <section className="home-cta-bottom">
        <h2>{t("home.ready")}</h2>
        <p>{t("home.readyBody")}</p>
        <div className="cta-row">
          <Link className="btn primary" to="/signin">
            {t("home.signInGoogle")}
          </Link>
          <Link className="btn" to="/contact">
            {t("home.hireUs")}
          </Link>
          <Link className="btn" to="/about">
            {t("home.learnMore")}
          </Link>
        </div>
      </section>

      <footer className="home-legal-links">
        <Link to="/privacy">{t("footer.privacy")}</Link>
        <span className="dot">·</span>
        <Link to="/terms">{t("footer.terms")}</Link>
      </footer>
    </>
  );
}
