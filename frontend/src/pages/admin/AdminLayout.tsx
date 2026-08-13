import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { BrandMark } from "../../components/BrandMark";
import { LanguageToggle } from "../../components/LanguageToggle";
import { useT } from "../../i18n/LocaleContext";

export function AdminLayout() {
  const t = useT();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = `${t("admin.eyebrow")} ${t("common.brand")}`;
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex,nofollow,noarchive";
  }, [t]);

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">{t("common.loading")}</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (user.role !== "ADMIN" && user.role !== "READONLY") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <section className="panel ops-shell ops-shell--bottom-nav">
      <header className="ops-top ops-top--slim">
        <div className="ops-top__brand">
          <BrandMark size="sm" showText />
          <div>
            <p className="eyebrow">
              {t("admin.eyebrow")}
              {!user.canWrite ? ` · ${t("admin.readonly")}` : ""}
            </p>
            <p className="muted ops-top__email">{user.email}</p>
          </div>
        </div>
        <LanguageToggle variant="header" />
      </header>

      <div className="ops-outlet">
        <Outlet />
      </div>
    </section>
  );
}
