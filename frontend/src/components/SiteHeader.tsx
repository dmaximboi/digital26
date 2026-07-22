import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BrandMark } from "./BrandMark";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About Us" },
  { to: "/verify", label: "Verify" },
  { to: "/check-agreement", label: "Agreements" },
  { to: "/contact", label: "Contact" },
] as const;

function NavLinks({
  onNavigate,
  id,
}: {
  onNavigate?: () => void;
  id?: string;
}) {
  return (
    <nav id={id} className="site-nav" aria-label="Primary">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={"end" in item ? item.end : false}
          className={({ isActive }) =>
            isActive ? "site-nav__link is-active" : "site-nav__link"
          }
          onClick={onNavigate}
        >
          {item.label}
        </NavLink>
      ))}
      <a
        className="site-nav__link site-nav__link--ext"
        href="https://dmaximboi.vercel.app"
        target="_blank"
        rel="noreferrer"
        onClick={onNavigate}
      >
        Profile
      </a>
    </nav>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
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

  const mobileDrawer =
    typeof document !== "undefined"
      ? createPortal(
          <>
            {open ? (
              <button
                type="button"
                className="nav-backdrop"
                aria-label="Close menu"
                onClick={closeMenu}
              />
            ) : null}
            <nav
              id={menuId}
              className={open ? "site-nav-drawer is-open" : "site-nav-drawer"}
              aria-label="Primary mobile"
              hidden={!open}
            >
              {NAV.map((item) => (
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
              <a
                className="site-nav__link site-nav__link--ext"
                href="https://dmaximboi.vercel.app"
                target="_blank"
                rel="noreferrer"
                onClick={closeMenu}
              >
                Profile
              </a>
            </nav>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <header className="site-header">
        <Link
          className="brand-link"
          to="/"
          aria-label="The Digital 26 home"
          onClick={closeMenu}
        >
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

        <div className="site-nav-desktop">
          <NavLinks onNavigate={closeMenu} />
        </div>
      </header>

      {mobileDrawer}
    </>
  );
}
