// Import required Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

// Initialize Firebase Authentication
const auth = getAuth(app);
auth.useDeviceLanguage(); // Set language to device's language

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Initialize Functions - specify us-central1 region explicitly
const functions = getFunctions(app, 'us-central1');

// Connect to Functions emulator if in development
if (import.meta.env.MODE === 'development') {
  try {
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log('Connected to Functions emulator');
  } catch (error) {
    console.warn('Failed to connect to Functions emulator:', error);
  }
}

// Export Firebase modules for use in other parts of the app
export { auth, db, storage, functions };
export default app;
