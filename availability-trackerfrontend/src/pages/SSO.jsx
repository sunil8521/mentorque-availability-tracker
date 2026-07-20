import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

function decodeJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export default function SSO() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const roleParam = searchParams.get("role");
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");

  const { resolvedRole, displayEmail, tokenPayload } = useMemo(() => {
    let role = roleParam;
    const payload = token ? decodeJwtPayload(token) : null;
    if (!role && payload) {
      role = payload.role || (payload.isAdmin ? "ADMIN" : "MENTOR");
    }
    if (!role || role === "undefined") role = "USER";
    return {
      resolvedRole: role,
      displayEmail: email || (userId ? `${userId}@sso` : "—"),
      tokenPayload: payload,
    };
  }, [token, roleParam, email, userId]);

  useEffect(() => {
    console.log("[SSO] tracker /sso received", {
      userId,
      email: email || null,
      role: resolvedRole,
      nameFromJwt:
        tokenPayload?.name ||
        tokenPayload?.fullName ||
        tokenPayload?.displayName ||
        null,
      jwtPayload: tokenPayload,
      token,
    });
    if (!token) {
      window.location.href = "/welcome";
      return;
    }
    try {
      const storage = sessionStorage;
      storage.setItem("token", token);
      storage.setItem("role", resolvedRole);
      storage.setItem("userId", userId);
      storage.setItem("userRole", resolvedRole);
      storage.setItem("user", JSON.stringify({ id: userId }));
      if (email) storage.setItem("userEmail", email);
      console.log("[SSO] sessionStorage after set:", {
        token: !!sessionStorage.getItem("token"),
        userRole: sessionStorage.getItem("userRole"),
        userId: sessionStorage.getItem("userId"),
      });
    } catch (err) {
      console.error("[SSO] Error setting sessionStorage", err);
      window.location.href = "/welcome";
      return;
    }

    try {
      sessionStorage.setItem(
        "sso_show_welcome_modal",
        JSON.stringify({ email: displayEmail, role: resolvedRole })
      );
    } catch (_) {}

    function doRedirect() {
      console.log("[SSO] Redirecting for role:", resolvedRole);
      if (resolvedRole === "ADMIN") window.location.href = "/admin";
      else if (resolvedRole === "MENTOR") window.location.href = "/mentor";
      else window.location.href = "/availability";
    }

    let cancelled = false;
    const HEALTH_URL = `${import.meta.env.VITE_API_URL || ""}/health`;
    const MAX_WAIT = 60000;
    const INTERVAL = 2000;
    const start = Date.now();

    async function waitForBackendAndRedirect() {
      console.log("[SSO] Pinging health:", HEALTH_URL);
      while (!cancelled && Date.now() - start < MAX_WAIT) {
        try {
          const res = await fetch(HEALTH_URL);
          console.log("[SSO] Health response status:", res.status);
          if (res.ok) {
            if (!cancelled) doRedirect();
            return;
          }
        } catch (err) {
          console.warn("[SSO] Health ping failed:", err.message);
        }
        await new Promise((r) => setTimeout(r, INTERVAL));
      }
      console.warn("[SSO] Max wait reached, redirecting anyway");
      if (!cancelled) doRedirect();
    }

    waitForBackendAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [token, resolvedRole, userId, email, displayEmail, tokenPayload]);

  if (!token) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/95 backdrop-blur-sm p-4">
      <div
        className="bg-navy-900 border-2 border-blue-500/50 rounded-2xl shadow-2xl p-10 max-w-lg w-full text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sso-modal-title"
      >
        <p id="sso-modal-title" className="text-slate-400 text-lg mb-6">
          Logging you in…
        </p>
        <p className="text-white text-xl sm:text-2xl font-bold mb-3 break-all">
          {displayEmail}
        </p>
        <p className="text-blue-400 text-xl sm:text-2xl font-semibold">
          {resolvedRole}
        </p>
        <div className="mt-8 h-2 w-full max-w-xs mx-auto rounded-full bg-navy-700 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full sso-progress-bar"
            style={{ width: "100%" }}
          />
        </div>
      </div>
      <style>{`
        .sso-progress-bar {
          animation: sso-pulse 1.5s ease-in-out infinite;
        }
        @keyframes sso-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}