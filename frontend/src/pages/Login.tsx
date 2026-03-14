import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LocationState {
  from?: { pathname: string };
}

interface ApiErrorPayload {
  error?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.error || fallback;
};

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const Login: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [socialMode, setSocialMode] = useState<'NONE' | 'PHONE'>('NONE');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [phoneForm, setPhoneForm] = useState({ phone_number: '', otp: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { state, login, loginWithGoogle, sendPhoneOtp, loginWithPhone, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState)?.from?.pathname || '/dashboard';
  const inputCls = 'ui-input';
  const btnPrimaryCls = 'ui-btn-primary w-full';

  useEffect(() => {
    if (state.isAuthenticated) navigate(from, { replace: true });
  }, [state.isAuthenticated, navigate, from]);

  useEffect(() => {
    if (state.error) { setError(state.error); clearError(); }
  }, [state.error, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(formData.email, formData.password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle('DONOR', 'LOGIN');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Google sign-in failed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await sendPhoneOtp(phoneForm.phone_number);
      setVerificationId(result.verification_id);
      setOtpSent(true);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!verificationId) return;
    setError('');
    setIsLoading(true);
    try {
      await loginWithPhone(verificationId, phoneForm.otp);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Phone login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-100 via-white to-secondary-100 p-3 sm:p-4 overflow-hidden">
      <div className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-primary-300/35 blur-3xl animate-float-medium"></div>
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-secondary-300/35 blur-3xl animate-float-slow"></div>
      <div className="absolute inset-0 bg-grid-mask opacity-15"></div>

      <div className="relative w-full max-w-5xl bg-white/85 border border-white/70 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex" style={{ minHeight: '540px' }}>

        {/* LEFT PANEL */}
        <div className="hidden md:flex flex-col items-center justify-center w-2/5 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white px-8 py-12 rounded-r-[4rem] z-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-mask opacity-10"></div>
          <div className="text-4xl mb-4">🥗</div>
          <h2 className="text-2xl font-bold text-center mb-2 relative">Hello, Welcome!</h2>
          <p className="text-sm text-primary-100 text-center mb-8 relative">Don't have an account?</p>
          <Link
            to="/register"
            className="relative px-8 py-2 rounded-full border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-primary-700 transition-all duration-200"
          >
            Register
          </Link>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 py-9 sm:py-10 md:px-12 bg-white/90">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Welcome Back</h2>
          <p className="text-center text-sm text-gray-500 mb-6">Sign in to continue your mission with FoodSave.</p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {socialMode === 'NONE' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Username / Email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={`${inputCls} pr-10`}
                />
                <span className="absolute right-3 top-3 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
              </div>

              <div className="relative">
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="Password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className={`${inputCls} pr-10`}
                />
                <span className="absolute right-3 top-3 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
              </div>

              <div className="text-right">
                <a href="#" className="text-xs text-gray-500 hover:text-primary-600">Forgot Password?</a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={btnPrimaryCls}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Signing in...
                  </span>
                ) : 'Login'}
              </button>

              <p className="text-center text-xs text-gray-500 md:hidden">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary-600 font-medium">Register</Link>
              </p>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">or login with social platforms</span>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  title="Sign in with Google"
                    className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center hover:border-primary-400 hover:shadow-sm transition-all bg-white disabled:opacity-50"
                >
                  {googleLoading
                    ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></span>
                    : <GoogleIcon size={20} />}
                </button>

                <button
                  type="button"
                  onClick={() => { setSocialMode('PHONE'); setError(''); }}
                  title="Sign in with Phone"
                  className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center hover:border-primary-400 hover:shadow-sm transition-all bg-white text-lg"
                >
                  📱
                </button>
              </div>
            </form>
          )}

          {socialMode === 'PHONE' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { setSocialMode('NONE'); setOtpSent(false); setVerificationId(null); setPhoneForm({ phone_number: '', otp: '' }); setError(''); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
              >
                ← Back
              </button>

              <h3 className="text-lg font-semibold text-gray-700 text-center">Phone Sign In</h3>

              <input
                name="phone_number"
                type="tel"
                placeholder="Phone number (e.g. +911234567890)"
                value={phoneForm.phone_number}
                onChange={e => setPhoneForm({ ...phoneForm, phone_number: e.target.value })}
                className={inputCls}
                disabled={otpSent}
              />

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading || !phoneForm.phone_number}
                  className={btnPrimaryCls}
                >
                  {isLoading ? 'Sending...' : 'Send OTP'}
                </button>
              ) : (
                <>
                  <input
                    name="otp"
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={phoneForm.otp}
                    onChange={e => setPhoneForm({ ...phoneForm, otp: e.target.value })}
                    className={`${inputCls} tracking-widest text-center`}
                  />
                  <button
                    type="button"
                    onClick={handlePhoneLogin}
                    disabled={isLoading}
                    className={btnPrimaryCls}
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setVerificationId(null); }}
                    className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Resend OTP
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
