import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { useAuth } from "../auth/AuthContext";

const PUBLIC_NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About Us" },
  { to: "/verify", label: "Verify" },
  { to: "/check-agreement", label: "Agreements" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuId = useId();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    setOpen(false);
    document.body.classList.remove("nav-open");
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove("nav-open");
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-open");
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "READONLY";
  const isStudent = user?.role === "STUDENT" && user.hasProfile;

  return (
    <header className="site-header">
      <Link className="brand-link" to="/" aria-label="The Digital 26 home" onClick={closeMenu}>
        <BrandMark size="sm" showText />
      </Link>

      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-toggle__bars" aria-hidden />
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      {open ? (
        <button type="button" className="nav-backdrop" aria-label="Close menu" onClick={closeMenu} />
      ) : null}

      <nav
        id={menuId}
        className={open ? "site-nav-desktop site-nav-drawer is-open" : "site-nav-desktop site-nav-drawer"}
        aria-label="Primary"
      >
        {PUBLIC_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : false}
            className={({ isActive }) =>
              isActive ? "site-nav__link is-active" : "site-nav__link"
            }
            onClick={closeMenu}
          >
            {item.label}
          </NavLink>
        ))}

        {!loading && !user && (
          <>
            <NavLink to="/apply" className={({ isActive }) => isActive ? "site-nav__link site-nav__link--cta is-active" : "site-nav__link site-nav__link--cta"} onClick={closeMenu}>
              Apply
            </NavLink>
            <NavLink to="/signin" className={({ isActive }) => isActive ? "site-nav__link is-active" : "site-nav__link"} onClick={closeMenu}>
              Sign In
            </NavLink>
          </>
        )}

        {!loading && isStudent && (
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? "site-nav__link is-active" : "site-nav__link"} onClick={closeMenu}>
            Dashboard
          </NavLink>
        )}

        {!loading && isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => isActive ? "site-nav__link site-nav__link--admin is-active" : "site-nav__link site-nav__link--admin"} onClick={closeMenu}>
            Admin
          </NavLink>
        )}

        {!loading && user && (
          <button type="button" className="site-nav__link site-nav__link--signout" onClick={() => { signOut(); closeMenu(); navigate("/"); }}>
            Sign Out
          </button>
        )}
      </nav>
    </header>
  );
}
