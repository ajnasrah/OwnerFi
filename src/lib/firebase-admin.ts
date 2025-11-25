import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

// Lazy initialization to prevent build-time Firebase imports
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;
let isInitialized = false;

async function initializeAdminSDK() {
  if (isInitialized) return { adminDb, adminAuth };

  try {
    // Dynamic imports to avoid build-time initialization
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');

    // Skip if already initialized
    if (getApps().length === 0) {
      // Check if we have the required environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;


      if (!projectId || !privateKey || !clientEmail) {
        isInitialized = true;
        return { adminDb: null, adminAuth: null };
      }

      initializeApp({
        credential: cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        })
      });
    }

    const app = getApps()[0];
    adminDb = getFirestore(app);
    adminAuth = getAuth(app);

  } catch (error) {
    adminDb = null;
    adminAuth = null;
  }

  isInitialized = true;
  return { adminDb, adminAuth };
}

// Export functions that initialize on demand
export async function getAdminDb(): Promise<Firestore | null> {
  const { adminDb } = await initializeAdminSDK();
  return adminDb;
}

export async function getAdminAuth() {
  const { adminAuth } = await initializeAdminSDK();
  return adminAuth;
}

// Legacy exports for backward compatibility (these will be null initially)
export { adminDb, adminAuth };

// Alias export for common usage pattern
export const db = adminDb;
export const admin = { db: adminDb, auth: adminAuth };

// Alias for code that expects getFirestore
export const getFirestore = getAdminDb;