import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../../auth/AdminAuthContext";
import { BrandMark } from "../../components/BrandMark";
import { useAdminPath } from "../../lib/adminPath";

export function AdminLayout() {
  const { path: adminPath, ready } = useAdminPath();
  const { user, loading, signOut } = useAdminAuth();

  if (!ready) {
    return (
      <section className="panel">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  if (!adminPath) {
    return <Navigate to="/" replace />;
  }

  const links = [
    { to: `/${adminPath}`, label: "Dashboard", end: true as const },
    { to: `/${adminPath}/messages`, label: "Messages" },
    { to: `/${adminPath}/agreements`, label: "Agreements" },
    { to: `/${adminPath}/certificates`, label: "Certificates" },
    { to: `/${adminPath}/clients`, label: "Clients" },
    { to: `/${adminPath}/audit`, label: "Audit" },
    { to: `/${adminPath}/agreements/new`, label: "New agreement" },
    { to: `/${adminPath}/certificates/new`, label: "New cert link" },
  ];

  if (loading) {
    return (
      <section className="panel">
        <p>Checking session…</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to={`/${adminPath}/login`} replace />;
  }

  return (
    <section className="panel admin-shell">
      <header className="admin-top">
        <div className="admin-top__brand">
          <BrandMark size="sm" showText />
          <div>
            <p className="eyebrow">Private console</p>
            <p className="muted admin-top__email">{user.email}</p>
          </div>
        </div>
        <button type="button" className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <nav className="admin-nav" aria-label="Admin">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={"end" in l ? l.end : false}
            className={({ isActive }) =>
              isActive ? "admin-nav__link is-active" : "admin-nav__link"
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="admin-outlet">
        <Outlet />
      </div>
    </section>
  );
}
