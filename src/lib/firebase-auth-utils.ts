import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin (server-side)
if (getApps().length === 0) {
  try {
    // Check if we have the required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

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
  }
}

export async function getFirebaseUser(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    // Get the authorization header
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authorization.split('Bearer ')[1];
    
    // For now, we'll implement a simple token validation
    // In production, you'd verify the Firebase ID token here
    
    return null; // Placeholder until admin SDK is properly configured
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// Temporary wrapper to maintain compatibility
export async function getSessionWithRole(requiredRole: string) {
  // For now, return a mock session to keep things working
  // This will be properly implemented with Firebase ID token verification
  return {
    user: {
      id: 'firebase-user-id',
      email: 'test@example.com',
      role: requiredRole
    }
  };
}

// Role validation
export function validateUserRole(user: Record<string, unknown>, requiredRole: string): boolean {
  return user?.role === requiredRole;
}