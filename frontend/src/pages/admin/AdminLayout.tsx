import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { BrandMark } from "../../components/BrandMark";

export function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

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

  const canWrite = user.canWrite;

  return (
    <section className="panel ops-shell ops-shell--bottom-nav">
      <header className="ops-top ops-top--slim">
        <div className="ops-top__brand">
          <BrandMark size="sm" showText />
          <div>
            <p className="eyebrow">Admin{!canWrite ? " · Read-only" : ""}</p>
            <p className="muted ops-top__email">{user.email}</p>
          </div>
        </div>
      </header>

      <div className="ops-outlet">
        <Outlet />
      </div>

      <nav className="bottom-nav bottom-nav--admin" aria-label="Admin">
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? "bottom-nav__item is-active" : "bottom-nav__item")}>
          <span className="bottom-nav__glyph" aria-hidden>⌂</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/admin/students" className={({ isActive }) => (isActive ? "bottom-nav__item is-active" : "bottom-nav__item")}>
          <span className="bottom-nav__glyph" aria-hidden>◎</span>
          <span>Students</span>
        </NavLink>
        <NavLink to="/admin/messages" className={({ isActive }) => (isActive ? "bottom-nav__item is-active" : "bottom-nav__item")}>
          <span className="bottom-nav__glyph" aria-hidden>✉</span>
          <span>Inbox</span>
        </NavLink>
        <NavLink to="/admin/certificates" className={({ isActive }) => (isActive ? "bottom-nav__item is-active" : "bottom-nav__item")}>
          <span className="bottom-nav__glyph" aria-hidden>▣</span>
          <span>Certs</span>
        </NavLink>
        <button
          type="button"
          className={moreOpen ? "bottom-nav__item is-active" : "bottom-nav__item"}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="bottom-nav__glyph" aria-hidden>☰</span>
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button type="button" className="bottom-nav__backdrop" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="bottom-nav__sheet bottom-nav__sheet--open" role="menu">
            <NavLink to="/admin/agreements" onClick={() => setMoreOpen(false)}>Agreements</NavLink>
            <NavLink to="/admin/chat" onClick={() => setMoreOpen(false)}>Class Chat</NavLink>
            <NavLink to="/admin/storage" onClick={() => setMoreOpen(false)}>Storage</NavLink>
            <NavLink to="/admin/clients" onClick={() => setMoreOpen(false)}>Clients</NavLink>
            <NavLink to="/admin/visits" onClick={() => setMoreOpen(false)}>Visitors</NavLink>
            <NavLink to="/admin/audit" onClick={() => setMoreOpen(false)}>Audit</NavLink>
            {canWrite && (
              <>
                <NavLink to="/admin/agreements/new" onClick={() => setMoreOpen(false)}>New agreement</NavLink>
                <NavLink to="/admin/certificates/new" onClick={() => setMoreOpen(false)}>Issue cert</NavLink>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                signOut();
                navigate("/");
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </section>
  );
}
