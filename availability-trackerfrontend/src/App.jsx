import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
// DISABLED: SSO-based auth pages (replaced with LoginPage)
// import SSO from "./pages/SSO";
// import Welcome from "./pages/Welcome";
import UserAvailability from "./pages/UserAvailability";
import MentorAvailability from "./pages/MentorAvailability";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSettings from "./pages/AdminSettings";
import AdminSchedules from "./pages/AdminSchedules";

const LOGIN_PATH = "/login";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function DefaultRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to={LOGIN_PATH} replace />;
  if (user.role === "MENTOR") return <Navigate to="/mentor" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <Navigate to="/availability" replace />;
}

function NormalizePathname({ children }) {
  const location = useLocation();
  const pathname = location.pathname;
  if (pathname.startsWith("//")) {
    const fixed = pathname.replace(/\/+/g, "/") + location.search;
    return <Navigate to={fixed} replace />;
  }
  return children;
}

export default function App() {
  return (
    <NormalizePathname>
      <Routes>
        {/* Login page */}
        <Route path={LOGIN_PATH} element={<LoginPage />} />

        {/* DISABLED: SSO routes (replaced with simple login) */}
        {/* <Route path="/welcome" element={<Welcome />} /> */}
        {/* <Route path="/sso" element={<SSO />} /> */}
        {/* <Route path="/sso/sso" element={<SSO />} /> */}

        {/* Legacy /welcome redirects to /login */}
        <Route path="/welcome" element={<Navigate to={LOGIN_PATH} replace />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultRedirect />} />
        <Route
          path="availability"
          element={
            <ProtectedRoute allowedRoles={["USER", "ADMIN"]}>
              <UserAvailability />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor"
          element={
            <ProtectedRoute allowedRoles={["MENTOR"]}>
              <MentorAvailability />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/schedules"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminSchedules />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </NormalizePathname>
  );
}
