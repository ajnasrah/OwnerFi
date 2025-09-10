import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (server-side only)
if (getApps().length === 0) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'ownerfi-95aa0',
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@ownerfi-95aa0.iam.gserviceaccount.com',
      })
    });
    console.log('🔥 Firebase Admin SDK initialized');
  } catch (error) {
    console.warn('🔥 Firebase Admin SDK initialization failed:', error.message);
  }
}

// Export admin services
export const adminDb = getFirestore();
export const adminAuth = getAuth();

export default { adminDb, adminAuth };