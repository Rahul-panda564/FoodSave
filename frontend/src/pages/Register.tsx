import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

interface ApiErrorPayload {
  error?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.error || fallback;
};

const Register: React.FC = () => {
  const [step, setStep] = useState<'FORM' | 'PHONE' | 'OTP'>('FORM');
  const [formData, setFormData] = useState({
    email: '', username: '', first_name: '', last_name: '',
    password: '', password_confirm: '', role: 'DONOR',
    phone_number: '', address: '', organization_name: '',
  });
  const [phoneForm, setPhoneForm] = useState({
    phone_number: '', otp: '', first_name: '', last_name: '',
    password: '', password_confirm: '', role: 'DONOR', email: '', organization_name: '',
  });
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { state, register, clearError, loginWithGoogle, sendPhoneOtp, registerWithPhone } = useAuth();
  const navigate = useNavigate();
  const inputCls = 'ui-input';
  const btnPrimaryCls = 'ui-btn-primary w-full';

  useEffect(() => {
    if (state.isAuthenticated) navigate('/dashboard');
  }, [state.isAuthenticated, navigate]);

  useEffect(() => {
    if (state.error) { setError(state.error); clearError(); }
  }, [state.error, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.password_confirm) { setError('Passwords do not match'); return; }
    setIsLoading(true); setError('');
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Registration failed.'));
    } finally { setIsLoading(false); }
  };

  const handleGoogleSignup = async () => {
    setError(''); setGoogleLoading(true);
    try {
      await loginWithGoogle('DONOR', 'REGISTER');
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Google sign-up failed'));
    } finally { setGoogleLoading(false); }
  };

  const handleSendOtp = async () => {
    setError(''); setIsLoading(true);
    try {
      const result = await sendPhoneOtp(phoneForm.phone_number);
      setVerificationId(result.verification_id);
      setStep('OTP');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to send OTP'));
    } finally { setIsLoading(false); }
  };

  const handlePhoneRegister = async () => {
    if (phoneForm.password !== phoneForm.password_confirm) { setError('Passwords do not match'); return; }
    if (!verificationId) { setError('Verification ID not found'); return; }
    setError(''); setIsLoading(true);
    try {
      await registerWithPhone({ ...phoneForm, verification_id: verificationId });
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Phone registration failed'));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-100 via-white to-secondary-100 p-3 sm:p-4 overflow-hidden">
      <div className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-primary-300/35 blur-3xl animate-float-medium"></div>
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-secondary-300/35 blur-3xl animate-float-slow"></div>
      <div className="absolute inset-0 bg-grid-mask opacity-15"></div>

      <div className="relative w-full max-w-5xl bg-white/85 border border-white/70 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex" style={{ minHeight: '580px' }}>

        {/* LEFT PANEL - register form */}
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 py-9 sm:py-10 md:px-12 overflow-y-auto bg-white/90">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            {step === 'FORM' ? 'Create Account' : step === 'PHONE' ? 'Phone Sign Up' : 'Verify OTP'}
          </h2>
          <p className="text-center text-sm text-gray-500 mb-5">Create your FoodSave account and start making impact.</p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Email/password registration form */}
          {step === 'FORM' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <select
                name="role"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className={inputCls}
              >
                <option value="DONOR">Donor (Restaurant / Hotel / Individual)</option>
                <option value="NGO">NGO (Organization)</option>
                <option value="VOLUNTEER">Volunteer</option>
              </select>

              <div className="grid grid-cols-2 gap-3">
                <input
                  name="first_name" type="text" placeholder="First name" required
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  className={inputCls}
                />
                <input
                  name="last_name" type="text" placeholder="Last name" required
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <input
                name="username" type="text" placeholder="Username" required
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className={inputCls}
              />
              <input
                name="email" type="email" placeholder="Email address" required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={inputCls}
              />

              {formData.role === 'NGO' && (
                <input
                  name="organization_name" type="text" placeholder="Organization name"
                  value={formData.organization_name}
                  onChange={e => setFormData({ ...formData, organization_name: e.target.value })}
                  className={inputCls}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <input
                  name="password" type="password" placeholder="Password" required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className={inputCls}
                />
                <input
                  name="password_confirm" type="password" placeholder="Confirm" required
                  value={formData.password_confirm}
                  onChange={e => setFormData({ ...formData, password_confirm: e.target.value })}
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={btnPrimaryCls}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>Creating...
                  </span>
                ) : 'Create Account'}
              </button>

              <p className="text-center text-xs text-gray-500 md:hidden">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 font-medium">Sign in</Link>
              </p>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">or sign up with</span>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={googleLoading}
                  title="Sign up with Google"
                  className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center hover:border-primary-400 hover:shadow-sm transition-all bg-white disabled:opacity-50"
                >
                  {googleLoading
                    ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></span>
                    : <GoogleIcon size={20} />}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('PHONE'); setError(''); }}
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
              <button
                type="button"
                onClick={() => { setStep('FORM'); setError(''); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <input
                type="tel"
                placeholder="Phone number (e.g. +911234567890)"
                value={phoneForm.phone_number}
                onChange={e => setPhoneForm({ ...phoneForm, phone_number: e.target.value })}
                className={inputCls}
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isLoading || !phoneForm.phone_number}
                className={btnPrimaryCls}
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
          )}

          {/* OTP + profile completion */}
          {step === 'OTP' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setStep('PHONE'); setError(''); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>

              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={phoneForm.otp}
                onChange={e => setPhoneForm({ ...phoneForm, otp: e.target.value })}
                className={`${inputCls} tracking-widest text-center`}
              />

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 mb-3 text-center">Complete your profile</p>
                <select
                  value={phoneForm.role}
                  onChange={e => setPhoneForm({ ...phoneForm, role: e.target.value })}
                  className={`${inputCls} mb-3`}
                >
                  <option value="DONOR">Donor</option>
                  <option value="NGO">NGO</option>
                  <option value="VOLUNTEER">Volunteer</option>
                </select>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text" placeholder="First name" required
                    value={phoneForm.first_name}
                    onChange={e => setPhoneForm({ ...phoneForm, first_name: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    type="text" placeholder="Last name" required
                    value={phoneForm.last_name}
                    onChange={e => setPhoneForm({ ...phoneForm, last_name: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <input
                  type="email" placeholder="Email (optional)"
                  value={phoneForm.email}
                  onChange={e => setPhoneForm({ ...phoneForm, email: e.target.value })}
                  className={`${inputCls} mb-3`}
                />

                {phoneForm.role === 'NGO' && (
                  <input
                    type="text" placeholder="Organization name"
                    value={phoneForm.organization_name}
                    onChange={e => setPhoneForm({ ...phoneForm, organization_name: e.target.value })}
                    className={`${inputCls} mb-3`}
                  />
                )}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="password" placeholder="Password" required
                    value={phoneForm.password}
                    onChange={e => setPhoneForm({ ...phoneForm, password: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    type="password" placeholder="Confirm" required
                    value={phoneForm.password_confirm}
                    onChange={e => setPhoneForm({ ...phoneForm, password_confirm: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePhoneRegister}
                disabled={isLoading}
                className={btnPrimaryCls}
              >
                {isLoading ? 'Creating...' : 'Complete Registration'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL - welcome back */}
        <div className="hidden md:flex flex-col items-center justify-center w-2/5 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white px-8 py-12 rounded-l-[4rem] z-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-mask opacity-10"></div>
          <div className="text-4xl mb-4">🥗</div>
          <h2 className="text-2xl font-bold text-center mb-2 relative">Welcome Back!</h2>
          <p className="text-sm text-primary-100 text-center mb-8 relative">Already have an account?</p>
          <Link
            to="/login"
            className="relative px-8 py-2 rounded-full border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-primary-700 transition-all duration-200"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;