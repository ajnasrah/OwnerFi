import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin (server-side)
if (getApps().length === 0) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'ownerfi-95aa0',
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@ownerfi-95aa0.iam.gserviceaccount.com',
      })
    });
    console.log('🔥 Firebase Admin SDK initialized successfully');
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