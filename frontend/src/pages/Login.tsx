import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Boxes, KeyRound, Loader2, UserPlus } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
        const res = await api.post('/auth/signup', {
          email,
          password,
          full_name: fullName
        });
        
        // Auto login after signup
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

  return (
    <div className="min-h-screen bg-nav flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-success/20 blur-[120px] pointer-events-none"></div>

      <div className="bg-white rounded-2xl shadow-float w-full max-w-md overflow-hidden z-10">
        <div className="bg-surface p-8 text-center border-b border-slate-100">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-nav text-accent mb-4 shadow-sm">
            <Boxes size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold mb-1">AssetFlow</h1>
          <p className="text-slate text-sm">Enterprise Resource Management</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-semibold mb-6">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                />
              </div>
            )}
            
            <div>
              <label className="form-label">Work Email</label>
              <input
                type="email"
                required
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-11 text-base mt-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isLogin ? (
                <>
                  <KeyRound size={18} /> Sign In
                </>
              ) : (
                <>
                  <UserPlus size={18} /> Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="ml-2 font-medium text-accent hover:text-accentHover focus:outline-none"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
