import { Link } from "react-router-dom";
import { useT } from "../i18n/LocaleContext";

export function SiteFooter() {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <p className="footer-brand__name">{t("common.brand")}</p>
            <p className="footer-tagline">{t("footer.tagline")}</p>
            <p className="footer-blurb">{t("footer.blurb")}</p>
            <p className="footer-rc">
              {t("home.rc")}
              <span className="footer-rc__check" aria-label={t("footer.registered")} title={t("footer.registered")}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.4-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z"
                  />
                </svg>
              </span>
            </p>
          </div>
          <nav className="footer-nav" aria-label={t("footer.academy")}>
            <p className="footer-heading">{t("footer.academy")}</p>
            <Link to="/curriculum">{t("footer.vibeTrack")}</Link>
            <Link to="/curriculum">{t("footer.curriculum")}</Link>
            <Link to="/quiz">{t("footer.quiz")}</Link>
            <Link to="/dictionary">{t("nav.dictionary")}</Link>
            <Link to="/verify">{t("footer.certificates")}</Link>
          </nav>
          <nav className="footer-nav" aria-label={t("footer.studio")}>
            <p className="footer-heading">{t("footer.studio")}</p>
            <Link to="/contact">{t("footer.rapidMvp")}</Link>
            <Link to="/check-agreement">{t("footer.agreements")}</Link>
            <Link to="/contact">{t("footer.contact")}</Link>
            <Link to="/about">{t("footer.about")}</Link>
          </nav>
          <nav className="footer-nav" aria-label={t("footer.legal")}>
            <p className="footer-heading">{t("footer.legal")}</p>
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <Link to="/terms">{t("footer.terms")}</Link>
            <Link to="/news">{t("footer.news")}</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <p className="footer-copy">
            {t("footer.copy", { year })} · digital26.online
          </p>
        </div>
      </div>
    </footer>
  );
}
