import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = getApps().length
  ? getApps()[0]
  : hasConfig
    ? initializeApp(firebaseConfig)
    : initializeApp({
        apiKey: "demo",
        authDomain: "demo.firebaseapp.com",
        projectId: "demo",
        storageBucket: "demo.appspot.com",
        messagingSenderId: "000",
        appId: "1:000:web:demo",
      });
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
