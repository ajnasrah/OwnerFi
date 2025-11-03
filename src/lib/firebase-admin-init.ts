/**
 * Firebase Admin Initialization
 * Lazy-loaded admin instance for server-side operations
 */

import { getAdminDb, getAdminAuth } from './firebase-admin';

// Lazy-loaded admin DB (async initialization)
let _adminDb: any = null;
let _adminAuth: any = null;

async function ensureInitialized() {
  if (!_adminDb) {
    _adminDb = await getAdminDb();
  }
  if (!_adminAuth) {
    _adminAuth = await getAdminAuth();
  }
  return { adminDb: _adminDb, adminAuth: _adminAuth };
}

// Export proxy that initializes on access
export const adminDb = new Proxy({} as any, {
  get: (_target, prop) => {
    // Return a function that initializes then accesses the property
    return async (...args: any[]) => {
      const { adminDb } = await ensureInitialized();
      if (!adminDb) throw new Error('Firebase Admin not initialized');
      const value = adminDb[prop];
      return typeof value === 'function' ? value.apply(adminDb, args) : value;
    };
  }
});

export const adminAuth = new Proxy({} as any, {
  get: (_target, prop) => {
    return async (...args: any[]) => {
      const { adminAuth } = await ensureInitialized();
      if (!adminAuth) throw new Error('Firebase Admin Auth not initialized');
      const value = adminAuth[prop];
      return typeof value === 'function' ? value.apply(adminAuth, args) : value;
    };
  }
});

// Simple sync access (for cases where caller knows it's initialized)
export async function getDb() {
  const { adminDb } = await ensureInitialized();
  return adminDb;
}

export async function getAuth() {
  const { adminAuth } = await ensureInitialized();
  return adminAuth;
}

export default {
  getDb,
  getAuth,
  adminDb,
  adminAuth,
};
