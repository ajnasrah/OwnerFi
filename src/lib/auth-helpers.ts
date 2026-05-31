/**
 * Authentication and Authorization Helpers
 *
 * Standardized helpers for checking authentication and authorization in API routes.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { NextResponse } from 'next/server';
import { ErrorResponses } from './api-error-handler';
import { AuditHelpers } from './audit-logger';
import { getSessionFromBearer } from './mobile-auth-bridge';

// Re-export extractActorFromRequest for convenience
export { extractActorFromRequest } from './audit-logger';

export interface ExtendedSession {
  user: {
    id: string;
    email: string;
    name?: string;
    phone?: string | null;
    role: 'buyer' | 'realtor' | 'admin';
  };
  expires: string;
}

export type UserRole = 'buyer' | 'realtor' | 'admin';

/**
 * Get session with type safety
 */
export async function getTypedSession(): Promise<ExtendedSession | null> {
  try {
    const session = await getServerSession(authOptions);
    return session as ExtendedSession | null;
  } catch (error) {
    console.error('[Auth] Failed to get session:', error);
    return null;
  }
}

/**
 * Get session and verify user has required role
 *
 * Returns null if not authenticated or doesn't have required role
 */
export async function getSessionWithRole(
  requiredRole: UserRole | UserRole[]
): Promise<ExtendedSession | null> {
  const session = await getTypedSession();

  if (!session?.user) {
    return null;
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!roles.includes(session.user.role)) {
    return null;
  }

  return session;
}

/**
 * Require authentication - returns error response if not authenticated.
 *
 * Tries the NextAuth session cookie first (web). If absent, falls
 * back to verifying an `Authorization: Bearer <Firebase ID token>`
 * header via getSessionFromBearer (mobile). Either path returns the
 * same ExtendedSession shape — route handlers can't tell which
 * transport authenticated the call.
 */
export async function requireAuth(
  request: Request
): Promise<{ session: ExtendedSession } | { error: NextResponse }> {
  const session =
    (await getTypedSession()) ?? (await getSessionFromBearer(request));

  if (!session?.user) {
    await AuditHelpers.logAuthFailure(
      {
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      'No session found'
    );

    return { error: ErrorResponses.unauthorized() };
  }

  return { session };
}

/**
 * Require specific role - returns error response if not authorized.
 *
 * Delegates authentication to requireAuth so the NextAuth-session +
 * Firebase-Bearer fallback only lives in one place; this helper just
 * adds the role check on top.
 */
export async function requireRole(
  request: Request,
  requiredRole: UserRole | UserRole[]
): Promise<{ session: ExtendedSession } | { error: NextResponse }> {
  const authResult = await requireAuth(request);
  if ('error' in authResult) return authResult;

  const { session } = authResult;
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  if (roles.includes(session.user.role)) return { session };

  await AuditHelpers.logAuthFailure(
    {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    },
    `Required role: ${Array.isArray(requiredRole) ? requiredRole.join(' or ') : requiredRole}, found: ${session.user.role}`
  );

  return { error: ErrorResponses.forbidden('Insufficient permissions') };
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getTypedSession();
  return session?.user?.role === 'admin';
}

/**
 * Check if user is realtor
 */
export async function isRealtor(): Promise<boolean> {
  const session = await getTypedSession();
  return session?.user?.role === 'realtor';
}

/**
 * Check if user is buyer
 */
export async function isBuyer(): Promise<boolean> {
  const session = await getTypedSession();
  return session?.user?.role === 'buyer';
}

/**
 * Verify cron secret for cron job endpoints
 */
export function verifyCronSecret(request: Request): boolean {
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    console.warn('[Auth] CRON_SECRET not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${CRON_SECRET}`;

  return authHeader === expectedAuth;
}

/**
 * Require cron authentication - returns error response if invalid
 */
export function requireCronAuth(
  request: Request
): { success: true } | { error: NextResponse } {
  if (!verifyCronSecret(request)) {
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

    // Don't use async audit logging here to avoid promise issues
    console.error('[Auth] Cron authentication failed from IP:', ipAddress);

    return {
      error: ErrorResponses.unauthorized('Invalid cron secret')
    };
  }

  return { success: true };
}

/**
 * Check if request is from Vercel Cron (for backward compatibility)
 * WARNING: This is less secure and should be phased out
 */
export function isVercelCron(request: Request): boolean {
  const userAgent = request.headers.get('user-agent');
  return userAgent === 'vercel-cron/1.0';
}

/**
 * Flexible cron auth that accepts either secret or Vercel cron
 * Use requireCronAuth() instead for better security
 */
export function requireCronAuthFlexible(
  request: Request
): { success: true } | { error: NextResponse } {
  const secretValid = verifyCronSecret(request);
  const isVercel = isVercelCron(request);

  if (!secretValid && !isVercel) {
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    console.error('[Auth] Cron authentication failed from IP:', ipAddress);

    return {
      error: ErrorResponses.unauthorized('Invalid cron authentication')
    };
  }

  if (isVercel && !secretValid) {
    console.warn('[Auth] Cron job authenticated via User-Agent (less secure)');
  }

  return { success: true };
}
