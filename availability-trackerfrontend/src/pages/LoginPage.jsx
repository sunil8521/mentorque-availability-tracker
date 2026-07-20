import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import MentorqueBrand from "../components/MentorqueLogo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "ADMIN") navigate("/admin", { replace: true });
      else if (user.role === "MENTOR") navigate("/mentor", { replace: true });
      else navigate("/availability", { replace: true });
    } catch (err) {
      setError(err?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center">
        
        {/* Logo and Tagline */}
        <MentorqueBrand size="lg" className="mb-3" textClassName="font-bold text-ink-50 tracking-tight text-3xl" />
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
              <label htmlFor="login-email" className="block text-[11px] font-semibold text-ink-200 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-navy-950 border border-white/[0.06] text-ink-50 placeholder-ink-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="login-password" className="block text-[11px] font-semibold text-ink-200 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-navy-950 border border-white/[0.06] text-ink-50 placeholder-ink-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors tracking-widest"
                placeholder="••••••••"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[14px] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
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
