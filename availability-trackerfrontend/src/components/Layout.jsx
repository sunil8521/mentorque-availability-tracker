import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MentorqueBrand from "./MentorqueLogo";

// DISABLED: SSO welcome modal (removed per assignment)
// const SSO_WELCOME_MODAL_KEY = "sso_show_welcome_modal";

function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatDisplayName(name, email) {
  const trimmed = name?.trim();
  if (trimmed && !trimmed.includes("@")) {
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map(capitalize)
      .join(" ");
  }
  const first = email?.split("@")[0]?.split(/[._-]+/).filter(Boolean)[0];
  return first ? capitalize(first) : "User";
}

function getInitials(name, email) {
  const trimmed = name?.trim();
  if (trimmed && !trimmed.includes("@")) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = email?.split("@")[0]?.split(/[._-]+/).filter(Boolean)[0] || "";
  return first.slice(0, 2).toUpperCase() || "?";
}

function IconCalendar({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconUsers({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function IconLayoutGrid({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function IconLogOut({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function navLinkClass({ isActive }) {
  return `inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
    isActive
      ? "bg-white/[0.08] text-ink-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "text-ink-400 hover:bg-white/[0.04] hover:text-ink-50"
  }`;
}

function UserMenu({ name, email, role, onLogout }) {
  const display = formatDisplayName(name, email);
  const initials = getInitials(name, email);

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 items-center gap-2.5" title={email || undefined}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04]"
          aria-hidden
        >
          <span className="text-[11px] font-bold leading-none text-ink-400">{initials}</span>
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="max-w-[8rem] truncate text-xs font-semibold text-ink-50">{display}</p>
          {role && (
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">{role}</p>
          )}
        </div>
      </div>
      <div className="hidden h-6 w-px bg-white/[0.08] sm:block" aria-hidden />
      <button
        type="button"
        onClick={onLogout}
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <IconLogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function HeaderBrand() {
  return (
    <Link to="/" className="flex shrink-0 items-center">
      <MentorqueBrand />
    </Link>
  );
}

function AvailabilityLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-400">
      <span className="inline-flex items-center gap-2">
        <span className="mq-slot-check h-2.5 w-2.5" aria-hidden>
          <svg
            className="h-1.5 w-1.5 text-white/85"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 6l2.5 2.5 4.5-5" />
          </svg>
        </span>
        Available
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-5 shrink-0 rounded-md bg-white/[0.06] border border-white/[0.08]" aria-hidden />
        Unavailable
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-5 shrink-0 rounded-md bg-navy-950/80 ring-1 ring-inset ring-white/[0.06]"
          aria-hidden
        />
        Past
      </span>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const email = user?.email ?? "";

  // DISABLED: SSO welcome modal state
  // const [welcomeModal, setWelcomeModal] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setScrolled(window.scrollY > 12);
  }, [location.pathname]);

  // DISABLED: SSO welcome modal effect
  // useEffect(() => {
  //   try {
  //     const raw = sessionStorage.getItem(SSO_WELCOME_MODAL_KEY);
  //     if (!raw) return;
  //     const data = JSON.parse(raw);
  //     sessionStorage.removeItem(SSO_WELCOME_MODAL_KEY);
  //     setWelcomeModal({ email: data.email || "—", role: data.role || "—" });
  //     const t = setTimeout(() => setWelcomeModal(null), 2500);
  //     return () => clearTimeout(t);
  //   } catch (_) {}
  // }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const schedulePath = user?.role === "MENTOR" ? "/mentor" : "/availability";
  const scheduleLabel = user?.role === "MENTOR" ? "Mentor Schedule" : "Your Schedule";
  const showAvailabilityLegend =
    location.pathname === "/availability" ||
    location.pathname === "/mentor" ||
    location.pathname === "/admin/schedules";

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      {/* DISABLED: SSO welcome modal (removed per assignment) */}

      <header
        className={`sticky top-0 z-50 isolate transition-[background-color,box-shadow,border-color] duration-300 ease-out ${
          scrolled
            ? "border-b border-white/[0.06] bg-navy-950/75 backdrop-blur-xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]"
            : "bg-transparent shadow-none"
        }`}
      >
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <HeaderBrand />

            <nav className="flex items-center gap-1">
              {isAdminRoute && user?.role === "ADMIN" ? (
                <>
                  <NavLink to="/admin" end className={navLinkClass}>
                    <IconLayoutGrid className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">Dashboard</span>
                  </NavLink>
                  <NavLink to="/admin/settings" className={navLinkClass}>
                    <span className="hidden md:inline">Settings</span>
                    <span className="md:hidden">Settings</span>
                  </NavLink>
                  <NavLink to={schedulePath} className={navLinkClass}>
                    <IconCalendar className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">{scheduleLabel}</span>
                  </NavLink>
                  <NavLink to="/admin/schedules" className={navLinkClass}>
                    <IconUsers className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">Team Schedules</span>
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink to={schedulePath} className={navLinkClass}>
                    <IconCalendar className="h-4 w-4 shrink-0" />
                    <span>{scheduleLabel}</span>
                  </NavLink>
                  {user?.role === "ADMIN" && (
                    <>
                      <NavLink to="/admin/schedules" className={navLinkClass}>
                        <IconUsers className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Team Schedules</span>
                      </NavLink>
                      <NavLink to="/admin" className={navLinkClass}>
                        <IconLayoutGrid className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Admin</span>
                      </NavLink>
                    </>
                  )}
                </>
              )}
            </nav>
          </div>

          <UserMenu name={user?.name} email={email} role={user?.role} onLogout={handleLogout} />
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-16">
        <Outlet />
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-navy-900/80 backdrop-blur-xl">
        <div className="mx-auto flex h-11 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <span className="text-xs text-ink-600">Mentorque Availability</span>
        </div>
      </footer>
    </div>
  );
}
