import { NavLink, useLocation } from "react-router-dom";
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
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="m4 7 8 6 8-6" />
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

export function BottomNav() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "ADMIN" || user?.role === "READONLY";
  const isStudent = user?.role === "STUDENT" && user.hasProfile;

  const accountTo = !loading && isAdmin ? "/admin" : !loading && (isStudent || user) ? "/dashboard" : "/signin";
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
