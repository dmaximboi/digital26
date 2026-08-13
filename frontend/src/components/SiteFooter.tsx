import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { LanguageToggle } from "./LanguageToggle";
import { useT } from "../i18n/LocaleContext";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandMark size="sm" showText />
        <LanguageToggle variant="inline" />
      </div>
      <div className="footer-cols">
        <div>
          <p className="footer-heading">{t("footer.navigate")}</p>
          <Link to="/">{t("nav.home")}</Link>
          <Link to="/about">{t("footer.about")}</Link>
          <Link to="/verify">{t("footer.certificates")}</Link>
          <Link to="/check-agreement">{t("footer.agreements")}</Link>
          <Link to="/contact">{t("footer.contact")}</Link>
          <a href="https://dmaximboi.vercel.app" target="_blank" rel="noreferrer">
            {t("footer.profile")}
          </a>
        </div>
        <div>
          <p className="footer-heading">{t("footer.legal")}</p>
          <Link to="/privacy">{t("footer.privacy")}</Link>
          <Link to="/terms">{t("footer.terms")}</Link>
        </div>
        <div>
          <p className="footer-heading">{t("common.brand")}</p>
          <p className="muted">{t("footer.tagline")}</p>
          <p className="muted">digital26.online · RC - 9710046</p>
        </div>
      </div>
      <p className="footer-copy">{t("footer.copy", { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
