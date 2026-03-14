import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  PhoneAuthProvider,
  signInWithCredential,
  RecaptchaVerifier,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth } from './config';

interface FirebaseErrorLike {
  code?: string;
}

const getFirebaseErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as FirebaseErrorLike).code;
  }
  return undefined;
};

const ensureFirebaseAuth = () => {
  if (!auth) {
    throw new Error('Firebase authentication is not configured. Set REACT_APP_FIREBASE_* variables.');
  }
  return auth;
};

export class FirebaseAuthService {
  /**
   * Register user with email and password
   */
  static async registerWithEmail(email: string, password: string, displayName?: string) {
    const firebaseAuth = ensureFirebaseAuth();
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    return userCredential.user;
  }

  /**
   * Login with email and password
   */
  static async loginWithEmail(email: string, password: string) {
    const firebaseAuth = ensureFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return userCredential.user;
  }

  /**
   * Login with Google
   */
  static async loginWithGoogle() {
    const firebaseAuth = ensureFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const userCredential = await signInWithPopup(firebaseAuth, provider);
      return userCredential.user;
    } catch (error: unknown) {
      const errorCode = getFirebaseErrorCode(error);
      if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/cancelled-popup-request') {
        await signInWithRedirect(firebaseAuth, provider);
        return null;
      }
      throw error;
    }
  }

  /**
   * Send phone verification code via SMS
   * Must be called within a user interaction event
   */
  static async sendPhoneVerificationCode(phoneNumber: string, containerId: string = 'recaptcha-container') {
    try {
      const firebaseAuth = ensureFirebaseAuth();
      // Initialize reCAPTCHA verifier
      const recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
        size: 'invisible',
        callback: (response: string) => {
          console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
        },
      });

      const phoneProvider = new PhoneAuthProvider(firebaseAuth);
      const verificationId = await phoneProvider.verifyPhoneNumber(
        phoneNumber,
        recaptchaVerifier
      );

      return verificationId;
    } catch (error: unknown) {
      console.error('Error sending phone verification code:', error);
      throw error;
    }
  }

  /**
   * Verify phone OTP code and login
   */
  static async verifyPhoneOtp(verificationId: string, otpCode: string) {
    const firebaseAuth = ensureFirebaseAuth();
    const phoneCredential = PhoneAuthProvider.credential(verificationId, otpCode);
    const userCredential = await signInWithCredential(firebaseAuth, phoneCredential);
    return userCredential.user;
  }

  /**
   * Logout user
   */
  static async logout() {
    const firebaseAuth = ensureFirebaseAuth();
    await signOut(firebaseAuth);
  }

  /**
   * Get current user
   */
  static getCurrentUser() {
    return auth?.currentUser || null;
  }

  /**
   * Get Firebase ID token for sending to backend
   */
  static async getIdToken() {
    const user = auth?.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChanged(callback: (user: User | null) => void) {
    if (!auth) {
      callback(null);
      return () => undefined;
    }
    return auth.onAuthStateChanged(callback);
  }
}

export default FirebaseAuthService;
