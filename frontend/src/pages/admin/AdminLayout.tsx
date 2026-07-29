import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { BrandMark } from "../../components/BrandMark";

export function AdminLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Admin The Digital 26";
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex,nofollow,noarchive";
  }, []);

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">Checking session...</p>
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
            <p className="eyebrow">Admin{!user.canWrite ? " · Read-only" : ""}</p>
            <p className="muted ops-top__email">{user.email}</p>
          </div>
        </div>
      </header>

      <div className="ops-outlet">
        <Outlet />
      </div>
    </section>
  );
}
