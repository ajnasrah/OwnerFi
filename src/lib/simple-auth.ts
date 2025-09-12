// NextRequest import removed as it's unused
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { ExtendedSession } from '@/types/session';

// Simple auth wrapper that doesn't throw errors
export async function getSessionSafe(): Promise<{ user: { id?: string; email?: string; role?: string } | null; isAuthenticated: boolean }> {
  try {
    const session = await getServerSession(authOptions as any) as ExtendedSession;
    return {
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email || undefined,
        role: session.user.role
      } : null,
      isAuthenticated: !!session?.user
    };
  } catch {
    return {
      user: null,
      isAuthenticated: false
    };
  }
}

// Role check that returns boolean instead of throwing
export async function hasRole(requiredRole: string): Promise<boolean> {
  try {
    const { user, isAuthenticated } = await getSessionSafe();
    return isAuthenticated && user?.role === requiredRole;
  } catch {
    return false;
  }
}

// Safe session getter for API routes
export async function getApiSession(): Promise<{ user: { id?: string; email?: string; role?: string } | null; authenticated: boolean; role?: string }> {
  const { user, isAuthenticated } = await getSessionSafe();
  return {
    user,
    authenticated: isAuthenticated,
    role: user?.role
  };
}