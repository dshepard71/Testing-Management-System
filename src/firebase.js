import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "testing-management-syste-c5d9a.firebaseapp.com",
  projectId: "testing-management-syste-c5d9a",
  storageBucket: "testing-management-syste-c5d9a.firebasestorage.app",
  messagingSenderId: "975124362712",
  appId: "1:975124362712:web:3d4cf08f4680f00d8d2ead",
  measurementId: "G-NZ5WT7VFNB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// const analytics = getAnalytics(app);
const analytics = null; // Hard-disabled for performance diagnosis
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, analytics };
