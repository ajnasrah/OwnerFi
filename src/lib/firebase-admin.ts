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
      hasPrivateKey: !!privateKey && privateKey.length > 100,
      hasClientEmail: !!clientEmail,
      NODE_ENV: process.env.NODE_ENV,
      projectIdValue: projectId,
      clientEmailValue: clientEmail
    });

    if (!projectId || !privateKey || !clientEmail) {
      console.error('🔥 Firebase Admin SDK environment variables missing:', {
        FIREBASE_PROJECT_ID: !!projectId,
        FIREBASE_PRIVATE_KEY: !!privateKey,
        FIREBASE_CLIENT_EMAIL: !!clientEmail
      });
      console.warn('🔥 Skipping Firebase Admin SDK initialization due to missing credentials');
    } else {
      const cleanPrivateKey = privateKey.replace(/\\n/g, '\n');
      
      initializeApp({
        credential: cert({
          projectId,
          privateKey: cleanPrivateKey,
          clientEmail,
        })
      });
      console.log('🔥 Firebase Admin SDK initialized successfully with project:', projectId);
    }
  } catch (error) {
    console.error('🔥 Firebase Admin SDK initialization failed:', {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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