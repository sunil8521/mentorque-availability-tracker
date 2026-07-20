import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center">

        {/* Logo and Tagline */}
        <div className="text-4xl font-bold tracking-tight mb-2 text-ink-50">
          Mentor<span className="text-purple-500">que</span>
        </div>
        <p className="text-ink-400 text-sm mb-8 font-medium">Mentoring Call Scheduling Platform</p>

        {/* Main Login Card */}
        <div className="w-full bg-navy-900 border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-ink-50 mb-1">Sign in</h1>
          <p className="text-[13px] text-ink-400 mb-6">Enter your credentials to access the platform</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-red-400 text-[13px] font-medium bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-ink-200 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-navy-950 border border-white/[0.06] text-ink-50 placeholder-ink-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-200 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-navy-950 border border-white/[0.06] text-ink-50 placeholder-ink-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors tracking-widest"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[14px] transition-all disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-ink-400 text-[12px] font-medium">
            No account?{" "}
            <Link to="/register" className="text-purple-400 hover:text-purple-300 hover:underline transition-colors">
              Register
            </Link>
          </p>
        </div>

        {/* Demo Credentials Box */}
        <div className="w-full mt-6 bg-navy-900 border border-white/[0.06] rounded-xl p-5 shadow-lg">
          <h3 className="text-[10px] font-bold text-ink-300 uppercase tracking-widest mb-3 border-b border-white/[0.06] pb-2">Demo Credentials</h3>

          <div className="space-y-2.5 text-[12px]">
            <div className="flex justify-between items-center group">
              <span className="font-semibold text-ink-200 group-hover:text-ink-50 transition-colors">Admin</span>
              <span className="text-ink-400 font-mono text-[11px]">admin@mentorque.com / admin123</span>
            </div>
            <div className="flex justify-between items-center group">
              <span className="font-semibold text-ink-200 group-hover:text-ink-50 transition-colors">Mentor</span>
              <span className="text-ink-400 font-mono text-[11px]">arjun.patel@mentorque.com / password123</span>
            </div>
            <div className="flex justify-between items-center group">
              <span className="font-semibold text-ink-200 group-hover:text-ink-50 transition-colors">User</span>
              <span className="text-ink-400 font-mono text-[11px]">amit.kumar@gmail.com / password123</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
