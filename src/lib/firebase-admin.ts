import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (server-side only)
if (getApps().length === 0) {
  try {
    // Check if we have the required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    console.log('🔥 Firebase Admin SDK initialization attempt:', {
      hasProjectId: !!projectId,
      hasPrivateKey: !!privateKey,
      hasClientEmail: !!clientEmail,
      NODE_ENV: process.env.NODE_ENV
    });

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('🔥 Firebase Admin SDK environment variables are missing, skipping initialization');
    } else {
      initializeApp({
        credential: cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        })
      });
      console.log('🔥 Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.warn('🔥 Firebase Admin SDK initialization failed:', error.message);
    // Don't re-throw - allow build to continue
  }
}

// Export admin services with safe fallbacks
let adminDb: any = null;
let adminAuth: any = null;

try {
  if (getApps().length > 0) {
    const app = getApps()[0];
    adminDb = getFirestore(app);
    adminAuth = getAuth(app);
    console.log('🔥 Firebase Admin services initialized');
  } else {
    console.warn('🔥 Firebase Admin services not available - no initialized apps');
  }
} catch (error) {
  console.warn('🔥 Failed to initialize Firebase Admin services:', error.message);
}

export { adminDb, adminAuth };
export default { adminDb, adminAuth };