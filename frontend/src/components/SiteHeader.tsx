import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BrandMark } from "./BrandMark";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About Us" },
  { to: "/verify", label: "Verify" },
  { to: "/check-agreement", label: "Agreements" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

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

  return (
    <header className="site-header">
      <Link className="brand-link" to="/" aria-label="The Digital 26 home">
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
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <nav
        id={menuId}
        className={open ? "site-nav is-open" : "site-nav"}
        aria-label="Primary"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : false}
            className={({ isActive }) =>
              isActive ? "site-nav__link is-active" : "site-nav__link"
            }
            onClick={() => setOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
        <a
          className="site-nav__link site-nav__link--ext"
          href="https://dmaximboi.vercel.app"
          target="_blank"
          rel="noreferrer"
          onClick={() => setOpen(false)}
        >
          Profile
        </a>
      </nav>
    </header>
  );
}
