import { useEffect, useMemo, useState } from "react";

/**
 * Shown when user opens the Availability Tracker without a valid SSO token.
 * If URL has token: decode and show who they're logging in as, then redirect to SSO.
 * Reads from window.location.search so token is never lost (e.g. after redirects).
 */
const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL || "https://app.mentorquedu.com/signin";

function decodeTokenPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

export default function Welcome() {
  const [redirecting, setRedirecting] = useState(false);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const urlParams = new URLSearchParams(search);
  const token = urlParams.get("token");

  const decoded = useMemo(() => (token ? decodeTokenPayload(token) : null), [token]);

  const displayEmail = decoded?.email || urlParams.get("email") || (decoded?.id ? `${decoded.id}@sso` : "—");
  const displayRole =
    decoded?.role ||
    (decoded?.isAdmin ? "ADMIN" : "MENTOR") ||
    urlParams.get("role") ||
    "USER";

  useEffect(() => {
    if (!token) return;
    const role = urlParams.get("role");
    const userId = urlParams.get("userId");
    const email = urlParams.get("email");
    const t = setTimeout(() => {
      setRedirecting(true);
      const params = new URLSearchParams({ token });
      if (role) params.set("role", role);
      if (userId) params.set("userId", userId);
      if (email) params.set("email", email);
      window.location.replace(`/sso?${params.toString()}`);
    }, 2000);
    return () => clearTimeout(t);
  }, [token]);

  useEffect(() => {
    if (token) return;
    const storedToken = sessionStorage.getItem("token") || localStorage.getItem("token");
    const storedRole = sessionStorage.getItem("userRole") || localStorage.getItem("userRole");
    if (storedToken && storedRole) {
      const path =
        storedRole === "ADMIN" ? "/admin" : storedRole === "MENTOR" ? "/mentor" : "/availability";
      window.location.replace(path);
    }
  }, [token]);

  if (token) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/95 backdrop-blur-sm p-4">
        <div
          className="bg-navy-900 border-2 border-blue-500/50 rounded-2xl shadow-2xl p-10 max-w-lg w-full text-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-sso-modal-title"
        >
          <p id="welcome-sso-modal-title" className="text-slate-400 text-lg mb-6">
            Logging you in…
          </p>
          <p className="text-white text-xl sm:text-2xl font-bold mb-3 break-all">
            {displayEmail}
          </p>
          <p className="text-blue-400 text-xl sm:text-2xl font-semibold">
            {displayRole}
          </p>
          <div className="mt-8 h-2 w-full max-w-xs mx-auto rounded-full bg-navy-700 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full welcome-sso-progress-bar"
              style={{ width: "100%" }}
            />
          </div>
          <p className="text-slate-500 text-sm mt-4">
            {redirecting ? "Redirecting..." : "Redirecting in a moment..."}
          </p>
        </div>
        <style>{`
          .welcome-sso-progress-bar {
            animation: welcome-sso-shrink 2s linear forwards;
          }
          @keyframes welcome-sso-shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    );
  }

  const isExpired = urlParams.get("expired") === "1";

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {isExpired && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-sm">
            Your session expired. Please open the Availability Tracker again from Mentorque.
          </div>
        )}
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-8 shadow-xl">
          <h1 className="text-xl font-semibold text-white mb-2">Availability Tracker</h1>
          <p className="text-slate-400 mb-6">
            Sign in on Mentorque, then use <strong className="text-slate-300">Check Availability</strong> or{" "}
            <strong className="text-slate-300">Add Availability</strong> to open the tracker with your role.
          </p>
          <a
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Go to Mentorque to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
