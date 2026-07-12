import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Boxes, Eye, EyeOff, KeyRound, Loader2, UserPlus, AlertTriangle } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        const res = await api.post('/auth/token', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        login(res.data.access_token, res.data.user);
        navigate('/');
      } else {
        await api.post('/auth/signup', { email, password, full_name: fullName });
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        const loginRes = await api.post('/auth/token', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        login(loginRes.data.access_token, loginRes.data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setPassword('');
    setShowPassword(false);
  };

  return (
    <div className="min-h-dvh bg-nav flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div
        className="absolute top-[-15%] left-[-8%] w-[45%] h-[45%] rounded-full
                   bg-accent/25 blur-[100px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-15%] right-[-8%] w-[45%] h-[45%] rounded-full
                   bg-success/20 blur-[100px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-[40%] right-[20%] w-[25%] h-[25%] rounded-full
                   bg-accent/10 blur-[80px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        {/* Card */}
        <div className="bg-surfaceCard rounded-3xl shadow-modal overflow-hidden">

          {/* Header Band */}
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent mb-5 shadow-float">
              <Boxes size={28} strokeWidth={2} className="text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-textPrimary tracking-tight">
              AssetFlow
            </h1>
            <p className="text-sm text-textSecondary mt-1">
              Enterprise Resource Management
            </p>
          </div>

          {/* Divider with mode label */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center px-8">
              <div className="w-full border-t border-borderBase" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surfaceCard px-4 text-xs font-medium text-textMuted uppercase tracking-wider">
                {isLogin ? 'Sign in to your account' : 'Create new account'}
              </span>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 pt-6 pb-8">
            {/* Error alert */}
            {error && (
              <div
                className="form-error-box mb-5 animate-fade-in"
                role="alert"
                aria-live="polite"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full name — signup only */}
              {!isLogin && (
                <div className="form-group animate-fade-in">
                  <label htmlFor="fullName" className="form-label">
                    Full Name <span className="text-danger" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    className="form-input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Work Email <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    className="form-input pr-11"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1
                               text-textMuted hover:text-textSecondary transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeOff size={16} aria-hidden="true" />
                      : <Eye     size={16} aria-hidden="true" />
                    }
                  </button>
                </div>
                {!isLogin && (
                  <p className="form-helper">Minimum 6 characters</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-11 text-sm font-semibold mt-2"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" aria-label="Loading" />
                ) : isLogin ? (
                  <>
                    <KeyRound size={17} aria-hidden="true" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus size={17} aria-hidden="true" />
                    Create Account
                  </>
                )}
              </button>
            </form>

            {/* Mode switch */}
            <p className="text-sm text-textSecondary text-center mt-6">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={switchMode}
                className="ml-1.5 font-semibold text-accent hover:text-accentHover
                           transition-colors focus-visible:underline"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          © {new Date().getFullYear()} AssetFlow · Enterprise
        </p>
      </div>
    </div>
  );
}
