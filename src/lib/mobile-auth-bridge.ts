/**
 * Mobile-auth bridge — verifies Firebase Bearer tokens from mobile
 * clients and synthesises an `ExtendedSession` the rest of the auth
 * helpers can consume unchanged.
 *
 * Why this exists: the web backend uses NextAuth (session cookies)
 * but the mobile app uses Firebase Auth (Bearer tokens minted via
 * `POST /api/auth/mobile-token`). `requireAuth()` historically only
 * read the NextAuth session, so every authenticated mobile endpoint
 * returned 401. This bridge gives `requireAuth()` a fallback path:
 * if there's no NextAuth session but the request carries a valid
 * Firebase ID token, verify it, look up the matching `users/{uid}`
 * record, and hand back an `ExtendedSession` shaped like the
 * NextAuth one. The downstream route handler can't tell which
 * transport authenticated the call — that's the point.
 *
 * Token claims (`role`, `phone`, `isInvestor`) baked in by the
 * mobile-token mint are intentionally **NOT** trusted here — we
 * re-read the user record on every request so a role change in
 * Firestore takes effect immediately rather than waiting for the
 * (~1h) Firebase ID token rotation.
 */

import { getAdminAuth } from './firebase-admin';
import { unifiedDb } from './unified-db';
import type { ExtendedSession, UserRole } from './auth-helpers';

const BEARER_PREFIX = 'Bearer ';

/**
 * Resolve the `Authorization: Bearer <Firebase ID token>` on a
 * Request to an `ExtendedSession`. Returns `null` for every
 * negative path (no header, malformed header, expired / revoked /
 * malformed token, no matching user row, `pending` role) — callers
 * surface that as 401 without distinguishing between them, the same
 * way NextAuth's "no session" path collapses every cookie failure
 * into a single null.
 */
export async function getSessionFromBearer(
  request: Request
): Promise<ExtendedSession | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) return null;

  const token = authHeader.slice(BEARER_PREFIX.length).trim();
  if (token.length === 0) return null;

  let uid: string;
  let exp: number;
  try {
    const auth = await getAdminAuth();
    if (!auth) return null;
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    exp = decoded.exp;
  } catch {
    // Expired / revoked / malformed / wrong-project tokens all land
    // here. Treat as "no session" — the route returns 401, the
    // mobile client surfaces an auth error and the user re-signs.
    return null;
  }

  const user = await unifiedDb.users.findById(uid);
  if (!user) return null;

  // 'pending' is a valid stored role for users who started signup
  // but haven't completed (e.g. a mobile email-signup with no role
  // assignment yet). They shouldn't pass authenticated route gates.
  if (!isAcceptedRole(user.role)) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
    // `decoded.exp` is in seconds; ExtendedSession.expires is an
    // ISO string (matches the NextAuth shape).
    expires: new Date(exp * 1000).toISOString(),
  };
}

function isAcceptedRole(role: string): role is UserRole {
  return role === 'buyer' || role === 'realtor' || role === 'admin';
}
