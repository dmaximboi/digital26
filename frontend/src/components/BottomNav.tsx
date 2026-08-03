import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Tab = {
  to: string;
  label: string;
  end?: boolean;
  match?: (path: string) => boolean;
};

const PUBLIC_TABS: Tab[] = [
  { to: "/", label: "Home", end: true },
  { to: "/verify", label: "Verify", match: (p) => p.startsWith("/verify") },
  {
    to: "/check-agreement",
    label: "Deals",
    match: (p) => p.startsWith("/check-agreement") || p.startsWith("/a/"),
  },
  { to: "/contact", label: "Contact" },
];

const STUDENT_TABS: Tab[] = [
  { to: "/dashboard", label: "Home", end: true },
  {
    to: "/dashboard/payment",
    label: "Pay",
    match: (p) => p.startsWith("/dashboard/payment"),
  },
  {
    to: "/dashboard/attendance",
    label: "Attend",
    match: (p) => p.startsWith("/dashboard/attendance"),
  },
  {
    to: "/dashboard/chat",
    label: "Chat",
    match: (p) => p.startsWith("/dashboard/chat"),
  },
];

const ADMIN_TABS: Tab[] = [
  { to: "/admin", label: "Home", end: true },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/messages", label: "Inbox" },
  {
    to: "/admin/certificates",
    label: "Certs",
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
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "Verify":
    case "Certs":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "Deals":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 13h6M9 17h4" />
        </svg>
      );
    case "Contact":
    case "Inbox":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="m4 7 8 6 8-6" />
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
    case "Attend":
      return (
        <svg {...common}>
          <path d="M8 7V4h8v3" />
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="m9 14 2 2 4-4" />
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
    case "More":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
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

function PublicBottomNav() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "ADMIN" || user?.role === "READONLY";
  const isStudent = user?.role === "STUDENT" && user.hasProfile;
  const onStudentArea =
    location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/apply");

  // Signed-in students get a dedicated dashboard nav that always includes Payment.
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
            <TabIcon name={tab.label} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    );
  }

  const accountTo =
    !loading && isAdmin ? "/admin" : !loading && (isStudent || user) ? "/dashboard" : "/signin";
  const accountLabel = !loading && isAdmin ? "Admin" : !loading && user ? "You" : "Sign in";

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {PUBLIC_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={() =>
            isActiveTab(tab, location.pathname) ? "bottom-nav__item is-active" : "bottom-nav__item"
          }
        >
          <TabIcon name={tab.label} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
      <NavLink
        to={accountTo}
        className={({ isActive }) =>
          isActive ||
          location.pathname.startsWith("/dashboard") ||
          location.pathname.startsWith("/apply") ||
          location.pathname.startsWith("/signin")
            ? "bottom-nav__item is-active"
            : "bottom-nav__item"
        }
      >
        <TabIcon name="Account" />
        <span>{accountLabel}</span>
      </NavLink>
    </nav>
  );
}

function AdminBottomNav() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
            <TabIcon name={tab.label} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={moreOpen ? "bottom-nav__item is-active" : "bottom-nav__item"}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <TabIcon name="More" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="bottom-nav__backdrop"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="bottom-nav__sheet" role="menu">
            <NavLink to="/admin/agreements" onClick={() => setMoreOpen(false)}>
              Agreements
            </NavLink>
            <NavLink to="/admin/chat" onClick={() => setMoreOpen(false)}>
              Class Chat
            </NavLink>
            <NavLink to="/admin/storage" onClick={() => setMoreOpen(false)}>
              Storage
            </NavLink>
            <NavLink to="/admin/clients" onClick={() => setMoreOpen(false)}>
              Clients
            </NavLink>
            <NavLink to="/admin/visits" onClick={() => setMoreOpen(false)}>
              Visitors
            </NavLink>
            <NavLink to="/admin/audit" onClick={() => setMoreOpen(false)}>
              Audit
            </NavLink>
            {canWrite && (
              <>
                <NavLink to="/admin/agreements/new" onClick={() => setMoreOpen(false)}>
                  New agreement
                </NavLink>
                <NavLink to="/admin/certificates/new" onClick={() => setMoreOpen(false)}>
                  Issue cert
                </NavLink>
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
