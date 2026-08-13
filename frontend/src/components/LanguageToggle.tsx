import { useLocale } from "../i18n/LocaleContext";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from "../i18n/types";

type Props = {
  variant?: "header" | "nav" | "inline";
};

export function LanguageToggle({ variant = "header" }: Props) {
  const { locale, setLocale, t } = useLocale();

  function cycle() {
    const idx = LOCALES.indexOf(locale);
    const next = LOCALES[(idx + 1) % LOCALES.length] as Locale;
    setLocale(next);
  }

  if (variant === "nav") {
    return (
      <button
        type="button"
        className="bottom-nav__item lang-toggle lang-toggle--nav"
        onClick={cycle}
        aria-label={t("nav.language")}
        title={LOCALE_LABELS[locale]}
      >
        <span className="lang-toggle__code" aria-hidden>
          {LOCALE_SHORT[locale]}
        </span>
        <span>{t("nav.language")}</span>
      </button>
    );
  }

  return (
    <div className={`lang-toggle lang-toggle--${variant}`} role="group" aria-label={t("nav.language")}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={code === locale ? "lang-toggle__btn is-active" : "lang-toggle__btn"}
          onClick={() => setLocale(code)}
          aria-pressed={code === locale}
          title={LOCALE_LABELS[code]}
        >
          {LOCALE_SHORT[code]}
        </button>
      ))}
    </div>
  );
}
