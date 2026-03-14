import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LocationState {
  from?: { pathname: string };
}

interface LoginFormState {
  email: string;
  password: string;
}

interface PhoneAuthState {
  phone_number: string;
  otp: string;
}

interface RegisterFormState {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
  role: string;
  phone_number: string;
  address: string;
  organization_name: string;
}

interface RegisterPhoneState {
  phone_number: string;
  otp: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
  role: string;
  email: string;
  organization_name: string;
}

interface OtpResponse {
  message?: string;
  otp_for_testing?: string;
  warning?: string;
}

const INITIAL_LOGIN_FORM: LoginFormState = { email: '', password: '' };
const INITIAL_LOGIN_PHONE_FORM: PhoneAuthState = { phone_number: '', otp: '' };
const INITIAL_REGISTER_FORM: RegisterFormState = {
  email: '', username: '', first_name: '', last_name: '',
  password: '', password_confirm: '', role: 'DONOR',
  phone_number: '', address: '', organization_name: '',
};
const INITIAL_REGISTER_PHONE_FORM: RegisterPhoneState = {
  phone_number: '', otp: '', first_name: '', last_name: '',
  password: '', password_confirm: '', role: 'DONOR', email: '', organization_name: '',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const maybeError = error as { response?: { data?: { error?: string } } };
  return maybeError?.response?.data?.error || fallback;
};

const buildOtpNotice = (response?: OtpResponse) => {
  const debugOtp = response?.otp_for_testing ? ` OTP: ${response.otp_for_testing}` : '';
  const warning = response?.warning ? ` (${response.warning})` : '';
  return `${response?.message || 'OTP sent successfully'}${debugOtp}${warning}`;
};

const AUTH_HIGHLIGHTS = [
  { icon: '⚡', title: 'Instant Coordination', text: 'Real-time sync across donors, NGOs, and volunteers.' },
  { icon: '🛡️', title: 'Trusted Platform', text: 'Verified workflows with secure and reliable delivery tracking.' },
  { icon: '📈', title: 'Visible Impact', text: 'Measure meals saved, response time, and food-waste reduction.' },
];

const AUTH_BADGES = ['Fast Onboarding', 'Phone + Google Login', 'Role-based Access'];

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
  required?: boolean;
  autoComplete?: string;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
  required = false,
  autoComplete,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={isVisible ? 'text' : 'password'}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${className} pr-14`}
      />
      <button
        type="button"
        onClick={() => setIsVisible((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-green-700 hover:text-green-900"
      >
        {isVisible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
};

const AuthPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = location.pathname === '/register';
  const from = (location.state as LocationState)?.from?.pathname || '/dashboard';

  const {
    state,
    login,
    register,
    loginWithGoogle,
    sendPhoneOtp,
    loginWithPhone,
    registerWithPhone,
    clearError,
  } = useAuth();

  const getDefaultRoute = (role?: string) => (role === 'ADMIN' ? '/admin-dashboard' : '/dashboard');

  const normalizePhoneNumber = (phone: string) => {
    const trimmed = phone.trim();
    const hasPlusPrefix = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return trimmed;
    if (hasPlusPrefix) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return `+${digits}`;
  };

  // Login state
  const [loginForm, setLoginForm] = useState<LoginFormState>(INITIAL_LOGIN_FORM);
  const [socialMode, setSocialMode] = useState<'NONE' | 'PHONE'>('NONE');
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loginPhoneForm, setLoginPhoneForm] = useState<PhoneAuthState>(INITIAL_LOGIN_PHONE_FORM);
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');

  // Register state
  const [step, setStep] = useState<'FORM' | 'PHONE' | 'OTP'>('FORM');
  const [registerForm, setRegisterForm] = useState<RegisterFormState>(INITIAL_REGISTER_FORM);
  const [registerPhoneForm, setRegisterPhoneForm] = useState<RegisterPhoneState>(INITIAL_REGISTER_PHONE_FORM);
  const [googleRegisterLoading, setGoogleRegisterLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerNotice, setRegisterNotice] = useState('');

  useEffect(() => {
    if (state.isAuthenticated && state.user) {
      navigate(getDefaultRoute(state.user.role), { replace: true });
    }
  }, [state.isAuthenticated, state.user, navigate]);

  useEffect(() => {
    if (state.error) {
      if (isRegister) setRegisterError(state.error);
      else setLoginError(state.error);
      clearError();
    }
  }, [state.error, clearError, isRegister]);

  useEffect(() => {
    setLoginForm(INITIAL_LOGIN_FORM);
    setSocialMode('NONE');
    setOtpSent(false);
    setLoginPhoneForm(INITIAL_LOGIN_PHONE_FORM);
    setLoginError('');
    setLoginNotice('');

    setStep('FORM');
    setRegisterForm(INITIAL_REGISTER_FORM);
    setRegisterPhoneForm(INITIAL_REGISTER_PHONE_FORM);
    setRegisterError('');
    setRegisterNotice('');
  }, [location.pathname]);

  // Login handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true); setLoginError('');
    try {
      const response = await login(loginForm.email, loginForm.password);
      navigate(response?.user?.role === 'ADMIN' ? '/admin-dashboard' : from, { replace: true });
    } catch (error: unknown) {
      setLoginError(getErrorMessage(error, 'Login failed. Please try again.'));
    } finally { setLoginLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setLoginError(''); setGoogleLoginLoading(true);
    try {
      const response = await loginWithGoogle('DONOR', 'LOGIN');
      if (response?.redirect) return;
      navigate(response?.user?.role === 'ADMIN' ? '/admin-dashboard' : from, { replace: true });
    } catch (error: unknown) {
      setLoginError(getErrorMessage(error, 'Google sign-in failed'));
    } finally { setGoogleLoginLoading(false); }
  };

  const handleSendLoginOtp = async () => {
    setLoginError(''); setLoginNotice(''); setLoginLoading(true);
    try {
      const normalizedPhoneNumber = normalizePhoneNumber(loginPhoneForm.phone_number);
      setLoginPhoneForm((prev) => ({ ...prev, phone_number: normalizedPhoneNumber }));
      const response = await sendPhoneOtp(normalizedPhoneNumber, 'LOGIN');
      setLoginNotice(buildOtpNotice(response));
      setOtpSent(true);
    } catch (error: unknown) {
      setLoginError(getErrorMessage(error, 'Failed to send OTP'));
    } finally { setLoginLoading(false); }
  };

  const handlePhoneLogin = async () => {
    setLoginError(''); setLoginLoading(true);
    try {
      const normalizedPhoneNumber = normalizePhoneNumber(loginPhoneForm.phone_number);
      const response = await loginWithPhone(normalizedPhoneNumber, loginPhoneForm.otp);
      navigate(response?.user?.role === 'ADMIN' ? '/admin-dashboard' : from, { replace: true });
    } catch (error: unknown) {
      setLoginError(getErrorMessage(error, 'Phone login failed'));
    } finally { setLoginLoading(false); }
  };

  // Register handlers
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.password_confirm) { setRegisterError('Passwords do not match'); return; }
    setRegisterLoading(true); setRegisterError('');
    try {
      await register(registerForm);
      navigate('/dashboard');
    } catch (error: unknown) {
      setRegisterError(getErrorMessage(error, 'Registration failed.'));
    } finally { setRegisterLoading(false); }
  };

  const handleGoogleSignup = async () => {
    setRegisterError(''); setGoogleRegisterLoading(true);
    try {
      const response = await loginWithGoogle('DONOR', 'REGISTER');
      if (response?.redirect) return;
      navigate(getDefaultRoute(response?.user?.role));
    } catch (error: unknown) {
      setRegisterError(getErrorMessage(error, 'Google sign-up failed'));
    } finally { setGoogleRegisterLoading(false); }
  };

  const handleSendRegisterOtp = async () => {
    setRegisterError(''); setRegisterNotice(''); setRegisterLoading(true);
    try {
      const normalizedPhoneNumber = normalizePhoneNumber(registerPhoneForm.phone_number);
      setRegisterPhoneForm((prev) => ({ ...prev, phone_number: normalizedPhoneNumber }));
      const response = await sendPhoneOtp(normalizedPhoneNumber, 'REGISTER');
      setRegisterNotice(buildOtpNotice(response));
      setStep('OTP');
    } catch (error: unknown) {
      setRegisterError(getErrorMessage(error, 'Failed to send OTP'));
    } finally { setRegisterLoading(false); }
  };

  const handlePhoneRegister = async () => {
    if (registerPhoneForm.password !== registerPhoneForm.password_confirm) { setRegisterError('Passwords do not match'); return; }
    setRegisterError(''); setRegisterLoading(true);
    try {
      const normalizedPhoneNumber = normalizePhoneNumber(registerPhoneForm.phone_number);
      const response = await registerWithPhone({ ...registerPhoneForm, phone_number: normalizedPhoneNumber });
      navigate(getDefaultRoute(response?.user?.role));
    } catch (error: unknown) {
      setRegisterError(getErrorMessage(error, 'Phone registration failed'));
    } finally { setRegisterLoading(false); }
  };

  // Navigation helpers
  const switchToRegister = () => { setLoginError(''); navigate('/register'); };
  const switchToLogin = () => { setRegisterError(''); navigate('/login'); };

  // Shared input class
  const inputCls = 'ui-input';
  const btnPrimaryCls = 'ui-btn-primary w-full';

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-100 via-white to-secondary-100 p-3 sm:p-4 overflow-hidden">
      <div className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-primary-300/35 blur-3xl animate-float-medium"></div>
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-secondary-300/35 blur-3xl animate-float-slow"></div>
      <div className="absolute inset-0 bg-grid-mask opacity-15"></div>

      <div className="relative w-full max-w-6xl bg-white/85 border border-white/70 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-b border-primary-100/70 bg-gradient-to-r from-white/70 to-primary-50/60">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex items-center text-left gap-2"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">🥗</span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">FoodSave Access</span>
              <span className="block text-xs text-gray-500">Secure sign in and onboarding</span>
            </span>
          </button>

          <div className="inline-flex rounded-xl border border-primary-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={switchToLogin}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all min-h-[42px] ${!isRegister ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-primary-700'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={switchToRegister}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all min-h-[42px] ${isRegister ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-primary-700'}`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Both form slots side by side (desktop) */}
        <div className="flex">

          {/* Register form slot (left, 50%) */}
          <div
            className={`${isRegister ? 'flex' : 'hidden md:flex'} w-full md:w-1/2 flex-col justify-center px-5 sm:px-8 py-9 sm:py-10 md:px-10 overflow-y-auto bg-white/90`}
            style={{
              opacity: isRegister ? 1 : 0,
              pointerEvents: isRegister ? 'auto' : 'none',
              transition: 'opacity 0.4s ease-in-out',
              transitionDelay: isRegister ? '0.3s' : '0s',
            }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
              {step === 'FORM' ? 'Create Account' : step === 'PHONE' ? 'Phone Sign Up' : 'Verify OTP'}
            </h2>
            <p className="text-center text-sm text-gray-500 mb-5">Join FoodSave and start creating measurable impact.</p>

            {registerError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">
                {registerError}
              </div>
            )}
            {registerNotice && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">
                {registerNotice}
              </div>
            )}

            {/* Email registration form */}
            {step === 'FORM' && (
              <form onSubmit={handleRegister} className="space-y-3" autoComplete="off">
                <select
                  value={registerForm.role}
                  onChange={e => setRegisterForm({ ...registerForm, role: e.target.value })}
                  className={inputCls}
                >
                  <option value="DONOR">Donor (Restaurant / Hotel / Individual)</option>
                  <option value="NGO">NGO (Organization)</option>
                  <option value="VOLUNTEER">Volunteer</option>
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text" placeholder="First name" required
                    value={registerForm.first_name}
                    onChange={e => setRegisterForm({ ...registerForm, first_name: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    type="text" placeholder="Last name" required
                    value={registerForm.last_name}
                    onChange={e => setRegisterForm({ ...registerForm, last_name: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <input
                  type="text" placeholder="Username" required
                  autoComplete="off"
                  value={registerForm.username}
                  onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="email" placeholder="Email address" required
                  autoComplete="off"
                  value={registerForm.email}
                  onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className={inputCls}
                />

                {registerForm.role === 'NGO' && (
                  <input
                    type="text" placeholder="Organization name"
                    value={registerForm.organization_name}
                    onChange={e => setRegisterForm({ ...registerForm, organization_name: e.target.value })}
                    className={inputCls}
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <PasswordInput
                    placeholder="Password"
                    required
                    autoComplete="new-password"
                    value={registerForm.password}
                    onChange={(value) => setRegisterForm({ ...registerForm, password: value })}
                    className={inputCls}
                  />
                  <PasswordInput
                    placeholder="Confirm"
                    required
                    autoComplete="new-password"
                    value={registerForm.password_confirm}
                    onChange={(value) => setRegisterForm({ ...registerForm, password_confirm: value })}
                    className={inputCls}
                  />
                </div>

                <button type="submit" disabled={registerLoading} className={btnPrimaryCls}>
                  {registerLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>Creating...
                    </span>
                  ) : 'Create Account'}
                </button>

                <p className="text-center text-xs text-gray-500 md:hidden">
                  Already have an account?{' '}
                  <button type="button" onClick={switchToLogin} className="text-primary-600 font-medium">Sign in</button>
                </p>

                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-gray-400">or continue with</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    type="button" onClick={handleGoogleSignup} disabled={googleRegisterLoading}
                    title="Sign up with Google"
                    className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center hover:border-primary-400 hover:shadow-sm transition-all bg-white disabled:opacity-50"
                  >
                    {googleRegisterLoading
                      ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></span>
                      : <GoogleIcon size={20} />}
                  </button>
                  <button
                    type="button" onClick={() => { setStep('PHONE'); setRegisterError(''); }}
                    title="Sign up with Phone"
                    className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center hover:border-primary-400 hover:shadow-sm transition-all bg-white text-lg"
                  >
                    📱
                  </button>
                </div>
              </form>
            )}

            {/* Phone number entry */}
            {step === 'PHONE' && (
              <div className="space-y-4">
                <button type="button" onClick={() => { setStep('FORM'); setRegisterError(''); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <input
                  type="tel" placeholder="Phone number (e.g. +911234567890)"
                  value={registerPhoneForm.phone_number}
                  onChange={e => setRegisterPhoneForm({ ...registerPhoneForm, phone_number: e.target.value })}
                  className={inputCls}
                />
                <button type="button" onClick={handleSendRegisterOtp}
                  disabled={registerLoading || !registerPhoneForm.phone_number}
                  className={btnPrimaryCls}>
                  {registerLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            )}

            {/* OTP + profile completion */}
            {step === 'OTP' && (
              <div className="space-y-3">
                <button type="button" onClick={() => { setStep('PHONE'); setRegisterError(''); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <input
                  type="text" placeholder="Enter 6-digit OTP"
                  value={registerPhoneForm.otp}
                  onChange={e => setRegisterPhoneForm({ ...registerPhoneForm, otp: e.target.value })}
                  className={`${inputCls} tracking-widest text-center`}
                />
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-3 text-center">Complete your profile</p>
                  <select value={registerPhoneForm.role}
                    onChange={e => setRegisterPhoneForm({ ...registerPhoneForm, role: e.target.value })}
                    className={`${inputCls} mb-3`}>
                    <option value="DONOR">Donor</option>
                    <option value="NGO">NGO</option>
                    <option value="VOLUNTEER">Volunteer</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" placeholder="First name" required
                      value={registerPhoneForm.first_name}
                      onChange={e => setRegisterPhoneForm({ ...registerPhoneForm, first_name: e.target.value })}
                      className={inputCls} />
                    <input type="text" placeholder="Last name" required
                      value={registerPhoneForm.last_name}
                      onChange={e => setRegisterPhoneForm({ ...registerPhoneForm, last_name: e.target.value })}
                      className={inputCls} />
                  </div>
                  <input type="email" placeholder="Email (optional)"
                    autoComplete="off"
                    value={registerPhoneForm.email}
                    onChange={e => setRegisterPhoneForm({ ...registerPhoneForm, email: e.target.value })}
                    className={`${inputCls} mb-3`} />
                  {registerPhoneForm.role === 'NGO' && (
                    <input type="text" placeholder="Organization name"
                      value={registerPhoneForm.organization_name}
                      onChange={e => setRegisterPhoneForm({ ...registerPhoneForm, organization_name: e.target.value })}
                      className={`${inputCls} mb-3`} />
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <PasswordInput
                      placeholder="Password"
                      required
                      autoComplete="new-password"
                      value={registerPhoneForm.password}
                      onChange={(value) => setRegisterPhoneForm({ ...registerPhoneForm, password: value })}
                      className={inputCls}
                    />
                    <PasswordInput
                      placeholder="Confirm"
                      required
                      autoComplete="new-password"
                      value={registerPhoneForm.password_confirm}
                      onChange={(value) => setRegisterPhoneForm({ ...registerPhoneForm, password_confirm: value })}
                      className={inputCls}
                    />
                  </div>
                </div>
                <button type="button" onClick={handlePhoneRegister} disabled={registerLoading}
                  className={btnPrimaryCls}>
                  {registerLoading ? 'Creating...' : 'Complete Registration'}
                </button>
              </div>
            )}
          </div>

          {/* Login form slot (right, 50%) */}
          <div
            className={`${!isRegister ? 'flex' : 'hidden md:flex'} w-full md:w-1/2 flex-col justify-center px-5 sm:px-8 py-9 sm:py-10 md:px-12 bg-white/90`}
            style={{
              opacity: isRegister ? 0 : 1,
              pointerEvents: isRegister ? 'none' : 'auto',
              transition: 'opacity 0.4s ease-in-out',
              transitionDelay: isRegister ? '0s' : '0.3s',
            }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Welcome Back</h2>
            <p className="text-center text-sm text-gray-500 mb-6">Sign in to continue your mission with FoodSave.</p>

            {loginError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">
                {loginError}
              </div>
            )}
            {loginNotice && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">
                {loginNotice}
              </div>
            )}

            {socialMode === 'NONE' && (
              <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                <div className="relative">
                  <input
                    type="email" required placeholder="Email"
                    autoComplete="off"
                    value={loginForm.email}
                    onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                    className={`${inputCls} pr-10`}
                  />
                  <span className="absolute right-3 top-3 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                </div>

                <PasswordInput
                  placeholder="Password"
                  required
                  autoComplete="new-password"
                  value={loginForm.password}
                  onChange={(value) => setLoginForm({ ...loginForm, password: value })}
                  className={inputCls}
                />

                <div className="text-right">
                  <button type="button" className="text-xs text-gray-500 hover:text-primary-600">Forgot Password?</button>
                </div>

                <button type="submit" disabled={loginLoading} className={btnPrimaryCls}>
                  {loginLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Signing in...
                    </span>
                  ) : 'Login'}
                </button>

                <p className="text-center text-xs text-gray-500 md:hidden">
                  Don't have an account?{' '}
                  <button type="button" onClick={switchToRegister} className="text-primary-600 font-medium">Register</button>
                </p>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-gray-400">or continue with</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    type="button" onClick={handleGoogleLogin} disabled={googleLoginLoading}
                    title="Sign in with Google"
                    className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center hover:border-primary-400 hover:shadow-sm transition-all bg-white disabled:opacity-50"
                  >
                    {googleLoginLoading
                      ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></span>
                      : <GoogleIcon size={20} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSocialMode('PHONE'); setLoginError(''); setLoginNotice(''); }}
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
                <button type="button"
                  onClick={() => { setSocialMode('NONE'); setOtpSent(false); setLoginPhoneForm({ phone_number: '', otp: '' }); setLoginError(''); setLoginNotice(''); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h3 className="text-lg font-semibold text-gray-700 text-center">Phone Sign In</h3>
                <input
                  type="tel" placeholder="Phone number (e.g. +911234567890)"
                  value={loginPhoneForm.phone_number}
                  onChange={e => setLoginPhoneForm({ ...loginPhoneForm, phone_number: e.target.value })}
                  className={inputCls}
                  disabled={otpSent}
                />
                {!otpSent ? (
                  <button type="button" onClick={handleSendLoginOtp}
                    disabled={loginLoading || !loginPhoneForm.phone_number}
                    className={btnPrimaryCls}>
                    {loginLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                ) : (
                  <>
                    <input
                      type="text" placeholder="Enter 6-digit OTP"
                      value={loginPhoneForm.otp}
                      onChange={e => setLoginPhoneForm({ ...loginPhoneForm, otp: e.target.value })}
                      className={`${inputCls} tracking-widest text-center`}
                    />
                    <button type="button" onClick={handlePhoneLogin} disabled={loginLoading}
                      className={btnPrimaryCls}>
                      {loginLoading ? 'Verifying...' : 'Verify & Sign In'}
                    </button>
                    <button type="button"
                      onClick={() => { setOtpSent(false); }}
                      className="w-full py-2 text-xs text-gray-500 hover:text-gray-700">
                      Resend OTP
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sliding blue panel (desktop only) */}
        <div
          className="hidden md:flex absolute top-0 bottom-0 w-1/2 z-10 flex-col items-center justify-center text-white"
          style={{
            left: isRegister ? '50%' : '0%',
            background: 'linear-gradient(135deg, #15803d 0%, #166534 40%, #14532d 100%)',
            borderRadius: isRegister ? '2.5rem 0 0 2.5rem' : '0 2.5rem 2.5rem 0',
            transition: 'left 0.7s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Login mode content - blue panel on left */}
          <div
            style={{
              position: 'absolute',
              textAlign: 'center',
              padding: '2rem',
              opacity: isRegister ? 0 : 1,
              transform: isRegister ? 'translateX(-16px)' : 'translateX(0)',
              transition: 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out',
              transitionDelay: isRegister ? '0s' : '0.45s',
              pointerEvents: isRegister ? 'none' : 'auto',
            }}
          >
            <div className="text-5xl mb-4">🥗</div>
            <h2 className="text-2xl font-bold mb-2">Hello, Welcome!</h2>
            <p className="text-sm text-primary-100 mb-5 px-4">New here? Join us and help reduce food waste.</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6 px-2">
              {AUTH_BADGES.map((badge) => (
                <span key={badge} className="text-[11px] px-2.5 py-1 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm text-primary-50">
                  {badge}
                </span>
              ))}
            </div>
            <div className="space-y-2 mb-7 px-2">
              {AUTH_HIGHLIGHTS.slice(0, 2).map((item) => (
                <div key={item.title} className="flex items-start gap-2 text-left">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.title}</p>
                    <p className="text-[11px] text-primary-100">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={switchToRegister}
              className="px-8 py-2 rounded-full border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-green-600 transition-all duration-200"
            >
              Register
            </button>
          </div>

          {/* Register mode content - blue panel on right */}
          <div
            style={{
              position: 'absolute',
              textAlign: 'center',
              padding: '2rem',
              opacity: isRegister ? 1 : 0,
              transform: isRegister ? 'translateX(0)' : 'translateX(16px)',
              transition: 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out',
              transitionDelay: isRegister ? '0.45s' : '0s',
              pointerEvents: isRegister ? 'auto' : 'none',
            }}
          >
            <div className="text-5xl mb-4">🥗</div>
            <h2 className="text-2xl font-bold mb-2">Welcome Back!</h2>
            <p className="text-sm text-primary-100 mb-5 px-4">Already have an account? Sign in.</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6 px-2">
              {AUTH_BADGES.map((badge) => (
                <span key={badge} className="text-[11px] px-2.5 py-1 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm text-primary-50">
                  {badge}
                </span>
              ))}
            </div>
            <div className="space-y-2 mb-7 px-2">
              {AUTH_HIGHLIGHTS.slice(1).map((item) => (
                <div key={item.title} className="flex items-start gap-2 text-left">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.title}</p>
                    <p className="text-[11px] text-primary-100">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={switchToLogin}
              className="px-8 py-2 rounded-full border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-green-600 transition-all duration-200"
            >
              Sign In
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuthPage;
