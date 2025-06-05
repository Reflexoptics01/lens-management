// Import required Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Validate environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
}

// Validate environment variables are present (production optimized)

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

// Validate API key format
if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('AIza')) {
  console.error('❌ Invalid Firebase API key format. API key should start with "AIza"');
  throw new Error('Invalid Firebase API key format');
}

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase initialization failed:', error.code);
  throw error;
}

// Initialize Firebase services
let auth, db, storage, functions;

try {
  auth = getAuth(app);
  auth.useDeviceLanguage();
  
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, 'us-central1');
} catch (error) {
  console.error('Firebase services initialization failed:', error.code);
  throw error;
}

// Connect to Functions emulator if in development (disabled for team member authentication)
// Note: Disabled emulator connection to use production Cloud Functions for team member auth
if (import.meta.env.MODE === 'development' && false) {
  try {
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log('✅ Connected to Functions emulator');
  } catch (error) {
    console.warn('⚠️ Failed to connect to Functions emulator:', error);
  }
}

// Production Cloud Functions enabled for team member authentication

// Export Firebase modules for use in other parts of the app
export { auth, db, storage, functions };
export default app;
