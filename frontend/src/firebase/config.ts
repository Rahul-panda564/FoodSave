import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "REDACTED_FIREBASE_KEY",
  authDomain: "foodsave-9c8af.firebaseapp.com",
  projectId: "foodsave-9c8af",
  storageBucket: "foodsave-9c8af.firebasestorage.app",
  messagingSenderId: "706732686148",
  appId: "1:706732686148:web:deb8207dda01f0b55b3511"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export default app;
