import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { LanguageToggle } from "./LanguageToggle";
import { useT } from "../i18n/LocaleContext";

/** Slim top brand bar — primary navigation lives in BottomNav. */
export function SiteHeader() {
  const t = useT();
  return (
    <header className="site-header site-header--slim">
      <Link className="brand-link" to="/" aria-label={t("common.brand")}>
        <BrandMark size="sm" showText />
      </Link>
      <LanguageToggle variant="header" />
    </header>
  );
}
