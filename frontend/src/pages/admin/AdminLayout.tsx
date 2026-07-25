import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { BrandMark } from "../../components/BrandMark";

export function AdminLayout() {
  const { user, loading, signOut } = useAuth();

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

  const links = [
    { to: "/admin", label: "Dashboard", end: true as const },
    { to: "/admin/students", label: "Students" },
    { to: "/admin/messages", label: "Messages" },
    { to: "/admin/visits", label: "Visitors" },
    { to: "/admin/agreements", label: "Agreements" },
    { to: "/admin/certificates", label: "Certificates" },
    { to: "/admin/clients", label: "Clients" },
    { to: "/admin/audit", label: "Audit" },
    { to: "/admin/agreements/new", label: "New agreement" },
    { to: "/admin/certificates/new", label: "New cert" },
  ];

  return (
    <section className="panel ops-shell">
      <header className="ops-top">
        <div className="ops-top__brand">
          <BrandMark size="sm" showText />
          <div>
            <p className="eyebrow">Admin Panel</p>
            <p className="muted ops-top__email">{user.email}</p>
          </div>
        </div>
        <button type="button" className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <nav className="ops-nav" aria-label="Admin">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={"end" in l ? l.end : false}
            className={({ isActive }) =>
              isActive ? "ops-nav__link is-active" : "ops-nav__link"
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="ops-outlet">
        <Outlet />
      </div>
    </section>
  );
}
