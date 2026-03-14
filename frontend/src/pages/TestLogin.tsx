import React, { useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface ApiErrorPayload {
  detail?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.detail || (axiosError as Error).message || fallback;
};

const TestLogin: React.FC = () => {
  const { login, state } = useAuth();
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    addLog(`Attempting login with: ${credentials.email}`);

    try {
      const response = await login(credentials.email, credentials.password);
      addLog(`Login successful! Token received: ${response.access ? 'YES' : 'NO'}`);
      addLog(`User role: ${response.user?.role}`);
      addLog(`User email: ${response.user?.email}`);
      
      // Force redirect to dashboard
      window.location.href = '/dashboard';
      
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Login failed');
      addLog(`Login failed: ${message}`);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const testCredentials = [
    { email: 'admin@example.com', password: 'password123', role: 'Admin' },
    { email: 'superadmin@foodsave.com', password: 'superadmin123', role: 'Superuser' },
    { email: 'donor@example.com', password: 'password123', role: 'Donor' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 px-4 sm:px-0 pb-10">
      <div className="relative overflow-hidden rounded-[1.6rem] sm:rounded-[2rem] bg-slate-950 p-6 sm:p-8 shadow-[0_30px_85px_-44px_rgba(15,23,42,0.85)] md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_35%),radial-gradient(circle_at_84%_20%,_rgba(249,115,22,0.2),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,118,110,0.9))]" />
        <div className="absolute inset-0 bg-grid-mask opacity-20" />
        <div className="relative text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Internal QA Surface</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Admin Login Test Console</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">Use this panel to validate role-based login tokens, auth state transitions, and redirect behavior in one place.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <div className="rounded-[1.4rem] sm:rounded-[1.8rem] border border-slate-200 bg-white/95 p-5 sm:p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.22)]">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Test Login</h2>

          {error && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your email"
                value={credentials.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />Testing login...</span>
              ) : (
                '🔑 Test Login'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/login" className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
              ← Back to Normal Login
            </a>
          </div>
        </div>

        <div className="rounded-[1.4rem] sm:rounded-[1.8rem] border border-slate-200 bg-white/95 p-5 sm:p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.22)] space-y-5">
          <h2 className="text-2xl font-bold text-slate-900">Available Test Accounts</h2>

          <div className="space-y-3">
            {testCredentials.map((cred, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="font-semibold text-slate-900">{cred.role}</div>
                <div className="text-sm text-slate-600 mt-1">
                  Email: <code className="rounded bg-white border border-slate-200 px-1.5 py-0.5">{cred.email}</code>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Password: <code className="rounded bg-white border border-slate-200 px-1.5 py-0.5">{cred.password}</code>
                </div>
                <button
                  onClick={() => setCredentials({ email: cred.email, password: cred.password })}
                  className="mt-3 inline-flex min-h-[42px] items-center rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 text-sm font-semibold"
                >
                  Use These Credentials
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-800 mb-2">🔍 Debug Info</h3>
            <div className="text-sm text-amber-700 space-y-1">
              <p><strong>Current User:</strong> {state.user?.email || 'Not logged in'}</p>
              <p><strong>User Role:</strong> {state.user?.role || 'No role'}</p>
              <p><strong>Auth Status:</strong> {state.isAuthenticated ? 'Authenticated' : 'Not authenticated'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.4rem] sm:rounded-[1.8rem] border border-slate-200 bg-slate-950 p-5 sm:p-6 lg:col-span-2 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.65)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold text-white">📋 Login Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 text-sm font-semibold border border-white/15 min-h-[42px]"
            >
              Clear Logs
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-slate-400 text-sm">No login attempts yet...</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-slate-200">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestLogin;
