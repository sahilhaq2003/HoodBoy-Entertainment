import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth, getDashboardPath } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const hasRedirected = useRef(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !hasRedirected.current) {
      hasRedirected.current = true;
      setRedirecting(true);
      setLoading(false);
      setTimeout(() => {
        navigate(getDashboardPath(user.role), { replace: true });
      }, 1200);
    }
  }, [user, navigate]);

  return (
    <div className="login-shell min-h-screen flex items-center justify-center p-4 md:p-8">
      {/* Background effects */}
      <div className="login-orb anim-float -top-32 -left-28 w-96 h-96 bg-sky-400/20 blur-3xl" />
      <div className="login-orb anim-float -bottom-40 -right-24 w-[34rem] h-[34rem] bg-[#4C1D95]/50 blur-3xl" style={{ animationDelay: '2.2s' }} />
      <div className="login-orb anim-float top-[42%] left-[38%] w-56 h-56 bg-purple-300/10 blur-3xl" style={{ animationDelay: '4.4s' }} />

      {/* Animated musical notes in background */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <span className="note-bg-float absolute top-[12%] left-[6%] text-purple-100/40 text-4xl">♪</span>
        <span className="note-bg-float absolute top-[20%] left-[16%] text-purple-50/30 text-2xl" style={{ animationDelay: '1.3s', animationDuration: '11s' }}>♫</span>
        <span className="note-bg-float absolute top-[40%] left-[3%] text-purple-100/30 text-3xl" style={{ animationDelay: '2.6s', animationDuration: '9.5s' }}>♬</span>
        <span className="note-bg-float absolute top-[62%] left-[10%] text-purple-50/30 text-xl" style={{ animationDelay: '3.9s', animationDuration: '12s' }}>♪</span>
        <span className="note-bg-float absolute top-[78%] left-[20%] text-purple-100/25 text-3xl" style={{ animationDelay: '5.2s', animationDuration: '10.5s' }}>♩</span>
        <span className="note-bg-float absolute top-[16%] right-[6%] text-purple-50/40 text-3xl" style={{ animationDelay: '0.6s', animationDuration: '11.5s' }}>♩</span>
        <span className="note-bg-float absolute top-[30%] right-[14%] text-purple-100/30 text-5xl" style={{ animationDelay: '1.9s', animationDuration: '9s' }}>♪</span>
        <span className="note-bg-float absolute top-[50%] right-[4%] text-purple-50/30 text-2xl" style={{ animationDelay: '3.2s', animationDuration: '12.5s' }}>♬</span>
        <span className="note-bg-float absolute top-[70%] right-[12%] text-purple-100/30 text-4xl" style={{ animationDelay: '4.5s', animationDuration: '10s' }}>♫</span>
        <span className="note-bg-float absolute top-[85%] right-[24%] text-purple-50/25 text-2xl" style={{ animationDelay: '5.8s', animationDuration: '11s' }}>♪</span>
        <span className="note-bg-float absolute top-[8%] left-[42%] text-purple-100/15 text-5xl" style={{ animationDelay: '0.3s', animationDuration: '13s' }}>♬</span>
        <span className="note-bg-float absolute top-[88%] left-[40%] text-purple-50/20 text-3xl" style={{ animationDelay: '2.1s', animationDuration: '12s' }}>♩</span>
      </div>

      {/* Centered card */}
      <div className="relative w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-[42%_58%] rounded-[24px] overflow-hidden bg-white shadow-[0_32px_90px_-20px_rgba(15,40,120,0.55)] anim-rise">
        {/* ------------------------- LEFT - Branding ------------------------- */}
        <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-12 overflow-hidden bg-gradient-to-br from-[#4C1D95] via-[#7C3AED] to-[#C084FC]">
          {/* Abstract shapes */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full border border-white/10" />
          <div className="absolute top-40 -right-16 w-40 h-40 rounded-full border border-dashed border-white/15" />
          <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-white/[0.06] blur-2xl" />
          <div className="absolute top-8 right-10 w-24 h-24 rounded-full bg-white/10 blur-xl" />
          <div className="absolute bottom-40 left-6 w-14 h-14 rounded-xl bg-white/10 rotate-12 hidden xl:block" />

          {/* Top row */}
          <div className="relative z-10 flex flex-col">
            <div className="flex items-center gap-3 mb-10">
              <img src="/logo.png" alt="HoodBoy Entertainment" className="w-20 h-20 object-contain flex-shrink-0 drop-shadow-lg" />
              <div>
                <div className="text-white font-bold text-xl tracking-tight">HoodBoy Entertainment</div>
                <div className="text-purple-200 text-[10.5px] font-medium tracking-wide uppercase">Lnkup Label Management Platform</div>
              </div>
            </div>

            <div>
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-100 mb-6">
                Music Label Platform
              </span>
              <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight mb-4">
                Hello,
                <br />
                Welcome!
              </h1>
              <p className="text-purple-100/90 text-sm leading-relaxed max-w-xs mb-9">
                Manage your account securely and access your dashboard.
              </p>

              <div className="space-y-3.5">
                {[
                  'Role-based dashboard access',
                  'Real-time artist & revenue analytics',
                  'Bank-grade account security',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={12} className="text-white" />
                    </span>
                    <span className="text-[13px] text-purple-50/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="relative z-10 mt-10 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-purple-100">
              <Lock size={10} />
              Secure Sign-In
            </span>
            <span className="text-[11px] text-purple-200/60 font-medium">v1.0</span>
          </div>
        </div>

        {/* ------------------------- RIGHT - Form ------------------------- */}
        <div className="relative bg-white p-6 sm:p-10 xl:p-12 flex flex-col justify-center">
          {/* Mobile branding banner */}
          <div className="lg:hidden mb-8 rounded-2xl relative overflow-hidden p-6 text-white bg-gradient-to-br from-[#4C1D95] via-[#7C3AED] to-[#C084FC]">
            <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-xl" />
            <div className="absolute bottom-0 left-0 w-full h-10 bg-white/[0.05] rounded-t-full" />
            <div className="relative z-10 flex items-center gap-3 mb-4">
              <img src="/logo.png" alt="HoodBoy Entertainment" className="w-16 h-16 object-contain flex-shrink-0" />
              <div>
                <div className="text-white font-bold tracking-tight">HoodBoy Entertainment</div>
                <div className="text-purple-200 text-[10px] font-medium uppercase tracking-wider">Lnkup Label Management Platform</div>
              </div>
            </div>
            <div className="relative z-10">
              <h1 className="text-xl font-bold tracking-tight mb-1">Hello, Welcome!</h1>
              <p className="text-purple-100/90 text-xs leading-relaxed">Manage your account securely and access your dashboard.</p>
            </div>
          </div>

          <div className="w-full max-w-[400px] mx-auto">
            {redirecting && user ? (
              <>
                {/* Loading animation after successful login */}
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-600 animate-spin" />
                    <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-purple-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CheckCircle2 size={28} className="text-purple-600 animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Welcome, {user.name}</h2>
                  <p className="text-sm text-gray-500 mb-4">Preparing your dashboard...</p>
                  <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#4C1D95] via-[#7C3AED] to-[#C084FC] rounded-full animate-loading-bar" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Login form */}
                <div className="mb-7">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
                  <p className="text-sm text-gray-500 mt-1.5">Sign in to your account to continue</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${focusedField === 'email' ? 'text-purple-600' : 'text-gray-400'}`} />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="w-full h-12 pl-11 pr-4 bg-gray-100/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10"
                        placeholder="you@hbelabel.com"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[13px] font-semibold text-gray-700">Password</label>
                      <button type="button" className="text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${focusedField === 'password' ? 'text-purple-600' : 'text-gray-400'}`} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="w-full h-12 pl-11 pr-11 bg-gray-100/70 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/20 accent-purple-600"
                    />
                    <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                      Keep me signed in
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-[#4C1D95] via-[#7C3AED] to-[#C084FC] hover:shadow-lg hover:shadow-purple-600/35 hover:-translate-y-0.5 active:translate-y-0 text-white font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-purple-600/25 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Sign In
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                  Don&apos;t have an account?{' '}
                  <a
                    href="#"
                    onClick={e => e.preventDefault()}
                    className="font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
                  >
                    Create an account
                  </a>
                </p>
              </>
            )}

            <p className="mt-8 pt-6 text-center text-xs text-gray-400 border-t border-gray-100">
              Lnkup Label Management Platform v1.0 &middot; &copy; 2026 HoodBoy Entertainment
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;