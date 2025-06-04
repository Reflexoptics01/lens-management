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

// Log environment variables status (without exposing sensitive data)
console.log('🔧 Firebase Environment Variables Status:');
requiredEnvVars.forEach(varName => {
  const value = import.meta.env[varName];
  console.log(`  ${varName}: ${value ? '✅ Present' : '❌ Missing'}`);
});

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
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase:', error);
  console.error('🔧 Firebase config used:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING'
  });
  throw error;
}

// Initialize Firebase Authentication
let auth;
try {
  auth = getAuth(app);
  auth.useDeviceLanguage(); // Set language to device's language
  console.log('✅ Firebase Auth initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Auth:', error);
  throw error;
}

// Initialize Firestore
let db;
try {
  db = getFirestore(app);
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firestore:', error);
  throw error;
}

// Initialize Storage
let storage;
try {
  storage = getStorage(app);
  console.log('✅ Firebase Storage initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Storage:', error);
  throw error;
}

// Initialize Functions - specify us-central1 region explicitly
let functions;
try {
  functions = getFunctions(app, 'us-central1');
  console.log('✅ Firebase Functions initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Functions:', error);
  throw error;
}

// Connect to Functions emulator if in development
if (import.meta.env.MODE === 'development') {
  try {
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log('✅ Connected to Functions emulator');
  } catch (error) {
    console.warn('⚠️ Failed to connect to Functions emulator:', error);
  }
}

// Export Firebase modules for use in other parts of the app
export { auth, db, storage, functions };
export default app;
