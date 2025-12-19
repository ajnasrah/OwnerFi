/**
 * Shared Firebase Admin Singleton
 * Used by unified scraper system v2
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | null = null;
let firestore: Firestore | null = null;

export function getFirebaseAdmin(): { app: App; db: Firestore } {
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        }),
      });
    } else {
      app = getApps()[0];
    }
  }

  if (!firestore) {
    firestore = getFirestore(app);
  }

  return { app, db: firestore };
}

export { FieldValue } from 'firebase-admin/firestore';
