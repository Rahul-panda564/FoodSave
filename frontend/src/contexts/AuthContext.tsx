import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';
import FirebaseAuthService from '../firebase/firebaseAuth';

// Types
export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN';
  phone_number?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  organization_name?: string;
  profile_image?: string;
  is_verified: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthSuccessPayload {
  user: User;
  access: string;
  refresh: string;
  redirect?: false;
}

interface RedirectAuthResult {
  redirect: true;
}

type GoogleAuthResult = AuthSuccessPayload | RedirectAuthResult;
type GenericPayload = unknown;
type PhoneOtpResponse = {
  message?: string;
  otp_for_testing?: string;
  warning?: string;
  verification_id: string | null;
} & Record<string, unknown>;
type PhoneVerificationResult = { user: unknown };

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REGISTER_START' }
  | { type: 'REGISTER_SUCCESS'; payload: User }
  | { type: 'REGISTER_FAILURE'; payload: string }
  | { type: 'LOAD_USER_START' }
  | { type: 'LOAD_USER_SUCCESS'; payload: User }
  | { type: 'LOAD_USER_FAILURE'; payload: string }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
    case 'LOAD_USER_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
    case 'LOAD_USER_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
    case 'LOAD_USER_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Context
const AuthContext = createContext<{
  state: AuthState;
  login: (email: string, password: string) => Promise<AuthSuccessPayload>;
  register: (userData: GenericPayload) => Promise<void>;
  loginWithGoogle: (googleRole?: 'DONOR' | 'NGO' | 'VOLUNTEER', mode?: 'LOGIN' | 'REGISTER') => Promise<GoogleAuthResult>;
  sendPhoneOtp: (phoneNumber: string, purpose?: 'LOGIN' | 'REGISTER') => Promise<PhoneOtpResponse>;
  verifyPhoneOtp: (phoneNumber: string, otp: string) => Promise<PhoneVerificationResult>;
  registerWithPhone: (payload: GenericPayload) => Promise<AuthSuccessPayload>;
  loginWithPhone: (phoneNumber: string, otp: string) => Promise<AuthSuccessPayload>;
  logout: () => void;
  clearError: () => void;
  updateUser: (userData: Partial<User>) => void;
} | null>(null);

// Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  interface ApiErrorLike {
    response?: {
      data?: unknown;
    };
    code?: string;
  }

  const extractErrorMessage = (error: unknown, fallback: string): string => {
    const responseData = (error as ApiErrorLike)?.response?.data;
    if (!responseData) {
      return fallback;
    }

    if (typeof responseData !== 'object') {
      return typeof responseData === 'string' ? responseData : fallback;
    }

    const responseRecord = responseData as Record<string, unknown>;

    if (typeof responseRecord.error === 'string') {
      return responseRecord.error;
    }

    if (typeof responseRecord.detail === 'string') {
      return responseRecord.detail;
    }

    const firstKey = Object.keys(responseRecord)[0];
    if (firstKey) {
      const firstValue = responseRecord[firstKey];
      if (Array.isArray(firstValue) && firstValue.length > 0) {
        return String(firstValue[0]);
      }
      if (typeof firstValue === 'string') {
        return firstValue;
      }
    }

    return fallback;
  };

  const getErrorCode = (error: unknown): string | undefined => {
    const candidate = error as ApiErrorLike;
    return typeof candidate?.code === 'string' ? candidate.code : undefined;
  };

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = FirebaseAuthService.onAuthStateChanged(async (firebaseUser) => {
      const accessToken = localStorage.getItem('access_token');

      if (firebaseUser) {
        try {
          if (accessToken) {
            loadUser();
            return;
          }

          const idToken = await firebaseUser.getIdToken();
          const displayNameParts = (firebaseUser.displayName || '').trim().split(' ');
          const firstName = displayNameParts[0] || '';
          const lastName = displayNameParts.slice(1).join(' ');

          let response;
          try {
            response = await authAPI.firebaseLoginGoogle({
              token: idToken,
              email: firebaseUser.email || undefined,
              first_name: firstName,
              last_name: lastName,
              role: 'DONOR',
              mode: 'LOGIN',
            });
          } catch (primaryError: unknown) {
            response = await authAPI.firebaseLoginGoogle({
              email: firebaseUser.email || undefined,
              first_name: firstName,
              last_name: lastName,
              role: 'DONOR',
              mode: 'LOGIN',
            });
          }

          const { user, access, refresh } = response.data;
          localStorage.setItem('access_token', access);
          localStorage.setItem('refresh_token', refresh);
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        } catch (error: unknown) {
          console.error('Error loading user:', error);
          if (accessToken) {
            loadUser();
          } else {
            dispatch({ type: 'LOAD_USER_FAILURE', payload: 'Google sign-in failed' });
          }
        }
      } else {
        if (accessToken) {
          loadUser();
        } else {
          dispatch({ type: 'LOGOUT' });
        }
      }
    });

    return unsubscribe;
  }, []);

  const loadUser = async () => {
    try {
      dispatch({ type: 'LOAD_USER_START' });
      const response = await authAPI.getProfile();
      dispatch({ type: 'LOAD_USER_SUCCESS', payload: response.data });
    } catch (error: unknown) {
      dispatch({ type: 'LOAD_USER_FAILURE', payload: 'Failed to load user' });
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  };

  const login = async (email: string, password: string): Promise<AuthSuccessPayload> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      const response = await authAPI.login({ email, password });

      const authData = response.data as AuthSuccessPayload;
      const { user, access, refresh } = authData;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return authData;
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, 'Login failed');
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const register = async (userData: GenericPayload) => {
    try {
      dispatch({ type: 'REGISTER_START' });
      const response = await authAPI.register(userData as Record<string, unknown>);

      const authData = response.data as AuthSuccessPayload;
      const { user, access, refresh } = authData;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      dispatch({ type: 'REGISTER_SUCCESS', payload: user });
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, 'Registration failed');
      dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const loginWithGoogle = async (
    googleRole?: 'DONOR' | 'NGO' | 'VOLUNTEER',
    mode: 'LOGIN' | 'REGISTER' = 'LOGIN'
  ): Promise<GoogleAuthResult> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      // Sign in with Firebase Google
      const firebaseUser = await FirebaseAuthService.loginWithGoogle();
      if (!firebaseUser) {
        return { redirect: true };
      }

      const idToken = await firebaseUser.getIdToken();
      const displayNameParts = (firebaseUser.displayName || '').trim().split(' ');
      const firstName = displayNameParts[0] || '';
      const lastName = displayNameParts.slice(1).join(' ');

      const googlePayload = {
        token: idToken,
        email: firebaseUser.email || undefined,
        first_name: firstName,
        last_name: lastName,
        role: googleRole || 'DONOR',
        mode,
      };

      let response;
      try {
        response = await authAPI.firebaseLoginGoogle(googlePayload);
      } catch (primaryError: unknown) {
        // Fallback: backend accepts email-only Google auth in development mode
        try {
          response = await authAPI.firebaseLoginGoogle({
            email: firebaseUser.email,
            first_name: firstName,
            last_name: lastName,
            role: googleRole || 'DONOR',
            mode,
          });
        } catch {
          throw primaryError;
        }
      }

      const { user, access, refresh } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return response.data as AuthSuccessPayload;
    } catch (error: unknown) {
      const firebaseCode = getErrorCode(error) ? ` (${getErrorCode(error)})` : '';
      const errorMessage = extractErrorMessage(error, `Google sign-in failed${firebaseCode}`);
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const sendPhoneOtp = async (phoneNumber: string, purpose: 'LOGIN' | 'REGISTER' = 'REGISTER'): Promise<PhoneOtpResponse> => {
    try {
      const response = await authAPI.sendPhoneOtp(phoneNumber, purpose);
      const responseData = (response.data || {}) as Record<string, unknown>;
      return {
        ...responseData,
        verification_id:
          typeof responseData.verification_id === 'string'
            ? responseData.verification_id
            : null,
      } as PhoneOtpResponse;
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, 'Failed to send OTP');
      dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const verifyPhoneOtp = async (verificationId: string, otp: string): Promise<PhoneVerificationResult> => {
    try {
      // Verify OTP with Firebase
      const firebaseUser = await FirebaseAuthService.verifyPhoneOtp(verificationId, otp);
      return { user: firebaseUser };
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, 'Failed to verify OTP');
      dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const registerWithPhone = async (payload: GenericPayload): Promise<AuthSuccessPayload> => {
    try {
      dispatch({ type: 'REGISTER_START' });
      const response = await authAPI.registerWithPhone(payload as Record<string, unknown>);

      const authData = response.data as AuthSuccessPayload;
      const { user, access, refresh } = authData;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      dispatch({ type: 'REGISTER_SUCCESS', payload: user });
      return authData;
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, 'Phone registration failed');
      dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const loginWithPhone = async (phoneNumber: string, otp: string): Promise<AuthSuccessPayload> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      const response = await authAPI.loginWithPhone(phoneNumber, otp);

      const authData = response.data as AuthSuccessPayload;
      const { user, access, refresh } = authData;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return authData;
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, 'Phone login failed');
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authAPI.logout(refreshToken);
      }
    } catch (error: unknown) {
      console.error('Logout error:', error);
    } finally {
      // Sign out from Firebase
      await FirebaseAuthService.logout();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      dispatch({ type: 'LOGOUT' });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const updateUser = (userData: Partial<User>) => {
    if (state.user) {
      const updatedUser = { ...state.user, ...userData };
      dispatch({ type: 'LOAD_USER_SUCCESS', payload: updatedUser });
    }
  };

  const value = {
    state,
    login,
    register,
    loginWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    registerWithPhone,
    loginWithPhone,
    logout,
    clearError,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
