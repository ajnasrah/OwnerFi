import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from './auth';
import { ExtendedSession, ExtendedUser } from '@/types/session';

// Check if user has required role, redirect if not
export async function requireRole(requiredRole: 'buyer' | 'realtor'): Promise<ExtendedSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getServerSession(authOptions as any) as ExtendedSession | null;
  
  if (!session?.user) {
    // Not logged in - redirect to appropriate signin
    if (requiredRole === 'buyer') {
      redirect('/auth/signin');
    } else {
      redirect('/realtor/signin');
    }
  }
  
  if (session.user.role !== requiredRole) {
    // Wrong role - redirect to their appropriate dashboard
    if (session.user.role === 'buyer') {
      redirect('/dashboard');
    } else if (session.user.role === 'realtor') {
      redirect('/realtor/dashboard');
    } else {
      // No role set - redirect to signin
      redirect('/auth/signin');
    }
  }
  
  return session;
}

// Get session and validate role for API routes
export async function getSessionWithRole(requiredRole: 'buyer' | 'realtor'): Promise<ExtendedSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getServerSession(authOptions as any) as ExtendedSession | null;
  
  if (!session?.user) {
    throw new Error('Not authenticated');
  }
  
  if (session.user.role !== requiredRole) {
    throw new Error(`Access denied. Required role: ${requiredRole}, current role: ${session.user.role}`);
  }
  
  return session;
}

// Check if current user can access a route
export function canAccessRoute(userRole: string | undefined, route: string): boolean {
  if (!userRole) return false;
  
  // Buyer routes
  if (route.startsWith('/dashboard')) {
    return userRole === 'buyer';
  }
  
  // Realtor routes  
  if (route.startsWith('/realtor')) {
    return userRole === 'realtor';
  }
  
  // Public routes
  return true;
}