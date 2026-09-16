import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DocBrandHeader } from "../components/BrandMark";
import { useT } from "../i18n/LocaleContext";
import { setPageMeta } from "../lib/seo";

export function VerifyPage() {
  const t = useT();
  const { publicId: routeId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(routeId ?? "");

  useEffect(() => {
    setPageMeta({
      title: t("verify.title"),
      description: t("verify.metaDesc"),
      path: "/verify",
    });
  }, [t]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = input.trim();
    if (!id) return;
    navigate(`/verify/${encodeURIComponent(id)}`);
  }

  return (
    <section className="panel verify-page">
      <DocBrandHeader title={t("verify.title")} />
      <p className="lede">{t("verify.lede")}</p>

      <form className="lookup-form verify-lookup" onSubmit={onSubmit}>
        <label htmlFor="certId">{t("verify.id")}</label>
        <div className="lookup-row verify-lookup__row">
          <input
            id="certId"
            name="certId"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="D26aB3xY9k"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn primary" type="submit">
            {t("verify.btn")}
          </button>
        </div>
      </form>
    </section>
  );
}
