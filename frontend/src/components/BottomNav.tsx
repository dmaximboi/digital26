import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/locales/en";
import { LanguageToggle } from "./LanguageToggle";

type Tab = {
  to: string;
  icon: string;
  labelKey: MessageKey;
  end?: boolean;
  match?: (path: string) => boolean;
};

const PUBLIC_TABS: Tab[] = [
  { to: "/", icon: "Home", labelKey: "nav.home", end: true },
  { to: "/verify", icon: "Verify", labelKey: "nav.verify", match: (p) => p.startsWith("/verify") },
  {
    to: "/check-agreement",
    icon: "Deals",
    labelKey: "nav.deals",
    match: (p) => p.startsWith("/check-agreement") || p.startsWith("/a/"),
  },
  { to: "/contact", icon: "Contact", labelKey: "nav.contact" },
];

const APP_ITEMS = [
  { to: "/quiz", icon: "Quiz", labelKey: "apps.quiz" as const },
  { to: "/news", icon: "News", labelKey: "apps.news" as const },
  { to: "/dictionary", icon: "Dictionary", labelKey: "apps.dictionary" as const },
];

const STUDENT_TABS: Tab[] = [
  { to: "/dashboard", icon: "Home", labelKey: "nav.home", end: true },
  {
    to: "/dashboard/library",
    icon: "Library",
    labelKey: "nav.library",
    match: (p) => p.startsWith("/dashboard/library"),
  },
  {
    to: "/dashboard/chat",
    icon: "Chat",
    labelKey: "nav.chat",
    match: (p) => p.startsWith("/dashboard/chat"),
  },
  {
    to: "/dashboard/payment",
    icon: "Pay",
    labelKey: "nav.pay",
    match: (p) => p.startsWith("/dashboard/payment"),
  },
];

const ADMIN_TABS: Tab[] = [
  { to: "/admin", icon: "Home", labelKey: "nav.home", end: true },
  { to: "/admin/students", icon: "Students", labelKey: "nav.students" },
  {
    to: "/admin/library",
    icon: "Library",
    labelKey: "nav.library",
    match: (p) => p.startsWith("/admin/library"),
  },
  {
    to: "/admin/certificates",
    icon: "Certs",
    labelKey: "nav.certs",
    match: (p) => p.startsWith("/admin/certificates"),
  },
];

function TabIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "Home":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.2" />
        </svg>
      );
    case "Quiz":
      return (
        <svg {...common}>
          <path d="M9 7h11M9 12h11M9 17h7" />
          <path d="M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      );
    case "News":
      return (
        <svg {...common}>
          <path d="M4 5h13a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3V5z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case "Verify":
      return (
        <svg {...common}>
          <rect x="4.5" y="6.5" width="11" height="13" rx="1.8" />
          <rect x="8.5" y="3.5" width="11" height="13" rx="1.8" />
          <path d="M11.5 8.5h5M11.5 11.5h3.5" />
        </svg>
      );
    case "Certs":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="12" rx="2" />
          <path d="M8 8h8M8 11.5h5" />
          <path d="M10 16v4l2-1.2L14 20v-4" />
        </svg>
      );
    case "Deals":
      return (
        <span className="material-symbols-outlined bottom-nav__glyph" aria-hidden>
          handshake
        </span>
      );
    case "Contact":
    case "Inbox":
      return (
        <svg {...common}>
          <rect x="3.2" y="5.5" width="17.6" height="13" rx="2.4" />
          <path d="m3.6 7.6 8.4 6.2 8.4-6.2" />
        </svg>
      );
    case "Pay":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      );
    case "Library":
      return (
        <svg {...common}>
          <path d="M4 4h6v16H4zM14 4h6v16h-6z" />
          <path d="M10 8h4M10 12h4" />
        </svg>
      );
    case "Chat":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 3V5z" />
        </svg>
      );
    case "Students":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 19c1.5-3 4-4.5 6-4.5S13.5 16 15 19" />
          <path d="M14 14.5c1.2 0 3 .8 4 3.5" />
        </svg>
      );
    case "Sign out":
    case "Sign in":
      return (
        <svg {...common}>
          <path d="M14.5 4.5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3.5" />
          <path d="M3.8 12H15" />
          <path d="m11.2 8.2 3.8 3.8-3.8 3.8" />
        </svg>
      );
    case "More":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "Apps":
      return (
        <svg {...common} strokeWidth="1.7">
          <rect x="3.2" y="3.2" width="7.4" height="7.4" rx="1.7" />
          <rect x="13.4" y="3.2" width="7.4" height="7.4" rx="1.7" />
          <rect x="3.2" y="13.4" width="7.4" height="7.4" rx="1.7" />
          <rect x="13.4" y="13.4" width="7.4" height="7.4" rx="1.7" />
        </svg>
      );
    case "Dictionary":
      return (
        <svg {...common}>
          <path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.2A3.2 3.2 0 0 1 5 16.3V4.5z" />
          <path d="M8.5 8.5h7M8.5 12h5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.8-3.5 4.2-5 7-5s5.2 1.5 7 5" />
        </svg>
      );
  }
}

function isActiveTab(tab: Tab, pathname: string): boolean {
  if (tab.match) return tab.match(pathname);
  if (tab.end) return pathname === tab.to;
  return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

function SignOutTab() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  return (
    <button
      type="button"
      className="bottom-nav__item"
      onClick={() => {
        signOut();
        navigate("/signin");
      }}
    >
      <TabIcon name="Sign out" />
      <span>{t("nav.signOut")}</span>
    </button>
  );
}

function PublicBottomNav() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const [appsOpen, setAppsOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN" || user?.role === "READONLY";
  const isStudent = user?.role === "STUDENT" && user.hasProfile;
  const onStudentArea =
    location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/apply");
  const appsActive =
    location.pathname.startsWith("/quiz") ||
    location.pathname.startsWith("/news") ||
    location.pathname.startsWith("/dictionary") ||
    location.pathname === "/glossary" ||
    location.pathname === "/tech-dictionary" ||
    location.pathname === "/tech-terms" ||
    location.pathname === "/terminology";

  useEffect(() => {
    setAppsOpen(false);
  }, [location.pathname]);

  if (!loading && isStudent && onStudentArea) {
    return (
      <nav className="bottom-nav" aria-label="Student">
        {STUDENT_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={() =>
              isActiveTab(tab, location.pathname)
                ? "bottom-nav__item is-active"
                : "bottom-nav__item"
            }
          >
            <TabIcon name={tab.icon} />
            <span>{t(tab.labelKey)}</span>
          </NavLink>
        ))}
        <SignOutTab />
      </nav>
    );
  }

  return (
    <>
    <nav className="bottom-nav" aria-label="Primary">
      {PUBLIC_TABS.slice(0, 1).map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={() =>
            isActiveTab(tab, location.pathname) ? "bottom-nav__item is-active" : "bottom-nav__item"
          }
        >
          <TabIcon name={tab.icon} />
          <span>{t(tab.labelKey)}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={appsOpen || appsActive ? "bottom-nav__item is-active" : "bottom-nav__item"}
        aria-expanded={appsOpen}
        aria-haspopup="dialog"
        onClick={() => setAppsOpen((v) => !v)}
      >
        <TabIcon name="Apps" />
        <span>{t("nav.apps")}</span>
      </button>
      {PUBLIC_TABS.slice(1).map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={() =>
            isActiveTab(tab, location.pathname) ? "bottom-nav__item is-active" : "bottom-nav__item"
          }
        >
          <TabIcon name={tab.icon} />
          <span>{t(tab.labelKey)}</span>
        </NavLink>
      ))}
      {!loading && isAdmin ? (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            isActive || location.pathname.startsWith("/admin")
              ? "bottom-nav__item is-active"
              : "bottom-nav__item"
          }
        >
          <TabIcon name="Account" />
          <span>{t("nav.admin")}</span>
        </NavLink>
      ) : !loading && user ? (
        <button
          type="button"
          className="bottom-nav__item"
          onClick={() => {
            signOut();
            navigate("/signin");
          }}
        >
          <TabIcon name="Sign out" />
          <span>{t("nav.signOut")}</span>
        </button>
      ) : (
        <NavLink
          to="/signin"
          className={({ isActive }) =>
            isActive || location.pathname.startsWith("/signin")
              ? "bottom-nav__item is-active"
              : "bottom-nav__item"
          }
        >
          <TabIcon name="Sign in" />
          <span>{t("nav.signIn")}</span>
        </NavLink>
      )}
    </nav>
      {appsOpen && (
        <>
          <button
            type="button"
            className="bottom-nav__backdrop"
            aria-label={t("common.closeMenu")}
            onClick={() => setAppsOpen(false)}
          />
          <div className="bottom-nav__apps" role="dialog" aria-label={t("apps.title")}>
            {APP_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() =>
                  location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                    ? "bottom-nav__app is-active"
                    : "bottom-nav__app"
                }
                onClick={() => setAppsOpen(false)}
              >
                <TabIcon name={item.icon} />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function AdminBottomNav() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const canWrite = Boolean(user?.canWrite);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav className="bottom-nav bottom-nav--admin" aria-label="Admin">
        {ADMIN_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={() =>
              isActiveTab(tab, location.pathname) ? "bottom-nav__item is-active" : "bottom-nav__item"
            }
          >
            <TabIcon name={tab.icon} />
            <span>{t(tab.labelKey)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={moreOpen ? "bottom-nav__item is-active" : "bottom-nav__item"}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <TabIcon name="More" />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="bottom-nav__backdrop"
            aria-label={t("common.closeMenu")}
            onClick={() => setMoreOpen(false)}
          />
          <div className="bottom-nav__sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-nav__sheet-lang">
              <LanguageToggle variant="inline" />
            </div>
            <NavLink to="/admin/messages" onClick={() => setMoreOpen(false)}>
              {t("nav.inbox")}
            </NavLink>
            <NavLink to="/admin/agreements" onClick={() => setMoreOpen(false)}>
              {t("nav.agreements")}
            </NavLink>
            <NavLink to="/admin/chat" onClick={() => setMoreOpen(false)}>
              {t("nav.classChat")}
            </NavLink>
            <NavLink to="/admin/library" onClick={() => setMoreOpen(false)}>
              {t("nav.library")}
            </NavLink>
            <NavLink to="/admin/storage" onClick={() => setMoreOpen(false)}>
              {t("nav.storage")}
            </NavLink>
            <NavLink to="/admin/clients" onClick={() => setMoreOpen(false)}>
              {t("nav.clients")}
            </NavLink>
            <NavLink to="/admin/visits" onClick={() => setMoreOpen(false)}>
              {t("nav.visitors")}
            </NavLink>
            <NavLink to="/admin/audit" onClick={() => setMoreOpen(false)}>
              {t("nav.audit")}
            </NavLink>
            {canWrite && (
              <>
                <NavLink to="/admin/agreements/new" onClick={() => setMoreOpen(false)}>
                  {t("nav.newAgreement")}
                </NavLink>
                <NavLink to="/admin/certificates/new" onClick={() => setMoreOpen(false)}>
                  {t("nav.issueCert")}
                </NavLink>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                signOut();
                navigate("/signin");
              }}
            >
              {t("nav.signOut")}
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** Viewport-fixed bottom bar (ported to body so panel transforms can't unstick it). */
export function BottomNav() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    isAdminRoute ? <AdminBottomNav /> : <PublicBottomNav />,
    document.body,
  );
}
