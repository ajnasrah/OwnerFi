import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Debug environment variables during build
console.log('🔥 Firebase env debug:', {
  NODE_ENV: process.env.NODE_ENV,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? `SET (${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 10)}...)` : 'MISSING',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'SET' : 'MISSING',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'SET' : 'MISSING',
  allKeys: Object.keys(process.env).filter(key => key.includes('FIREBASE')).length
});

// Check if we have the minimum required environment variables
const hasFirebaseConfig = !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

// Initialize Firebase (only once) - skip during build if no config available
let app = null;
let db = null;
let auth = null;
let storage = null;

if (hasFirebaseConfig) {
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
    };

    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log('🔥 Firebase client SDK initialized successfully');
  } catch (error) {
    console.warn('🔥 Firebase client initialization failed:', error.message);
    // Reset to null on failure
    app = null;
    db = null;
    auth = null;
    storage = null;
  }
} else {
  console.log('🔥 Skipping Firebase client initialization - missing environment variables');
}

export { db, auth, storage };

export default app;