import { Firestore } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Safe Firebase helper that ensures we have a valid Firestore instance
 */
export function getFirestoreInstance(): Firestore {
  if (!db) {
    throw new Error('Firebase Firestore is not initialized. Check your environment variables.');
  }
  return db;
}

/**
 * Check if Firebase is properly initialized
 */
export function isFirebaseInitialized(): boolean {
  return db !== null;
}

/**
 * Safe database getter with helpful error message
 */
export function getSafeDb(): Firestore {
  const firestore = getFirestoreInstance();
  return firestore;
}