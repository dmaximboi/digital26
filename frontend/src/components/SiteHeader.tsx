import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { LanguageToggle } from "./LanguageToggle";
import { useT } from "../i18n/LocaleContext";

export function SiteHeader() {
  const t = useT();
  return (
    <header className="site-header site-header--slim">
      <div className="site-header__inner">
        <Link className="brand-link" to="/" aria-label={t("common.brand")}>
          <BrandMark size="sm" showText />
        </Link>
        <nav className="site-header__nav" aria-label={t("footer.navigate")}>
          <Link to="/about">{t("nav.about")}</Link>
          <Link to="/curriculum">{t("nav.training")}</Link>
          <Link to="/contact">{t("nav.services")}</Link>
          <Link to="/verify">{t("nav.verify")}</Link>
          <Link to="/news">{t("footer.news")}</Link>
          <Link to="/dictionary">{t("nav.dictionary")}</Link>
        </nav>
        <div className="site-header__tools">
          <LanguageToggle variant="header" />
          <Link className="btn sm header-signin" to="/signin">
            {t("home.signInGoogle")}
          </Link>
        </div>
      </div>
    </header>
  );
}
