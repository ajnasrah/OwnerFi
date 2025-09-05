import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

// Simple auth wrapper that doesn't throw errors
export async function getSessionSafe(): Promise<{ user: any; isAuthenticated: boolean }> {
  try {
    const session = await getServerSession(authOptions);
    return {
      user: session?.user || null,
      isAuthenticated: !!session?.user
    };
  } catch (error) {
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
  } catch (error) {
    return false;
  }
}

// Safe session getter for API routes
export async function getApiSession(): Promise<{ user: any; authenticated: boolean; role?: string }> {
  const { user, isAuthenticated } = await getSessionSafe();
  return {
    user,
    authenticated: isAuthenticated,
    role: user?.role
  };
}