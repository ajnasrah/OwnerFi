/**
 * Firestore-backed rate limiter. Replaces in-memory Map rate limits that
 * reset on every serverless cold start — those leak enumeration across
 * restarts. This variant persists counts in a `rate_limits` collection
 * keyed by the caller-supplied identifier (hashed if sensitive).
 *
 * Collection: `rate_limits`
 * Doc id:     `${namespace}:${key}` (e.g. "do-not-sell:ip:1.2.3.4")
 * Fields:
 *   count      number
 *   windowMs   number   — echoed from caller for debugging
 *   resetAt    Timestamp
 *   updatedAt  Timestamp
 *
 * Stale docs (resetAt in the past) are cleaned up opportunistically on
 * the next hit for that key — no sweep cron needed for small volumes.
 */

import { getFirebaseAdmin, FieldValue } from './scraper-v2/firebase-admin';

const COLLECTION = 'rate_limits';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSecs: number;
}

export async function checkRateLimit(opts: {
  namespace: string;
  key: string;
  maxRequests: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { namespace, key, maxRequests, windowMs } = opts;
  const { db } = getFirebaseAdmin();

  const docId = `${namespace}:${key}`.replace(/\//g, '_').slice(0, 1400); // Firestore doc id cap
  const ref = db.collection(COLLECTION).doc(docId);
  const now = Date.now();

  // Use a transaction so multiple concurrent requests can't both see
  // count=maxRequests-1 and both succeed (the bug the in-memory Map had).
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const resetAt: number = data?.resetAt?.toMillis?.() ?? data?.resetAt ?? 0;

    // Window expired or no prior record — start fresh
    if (!data || now > resetAt) {
      const newResetAt = now + windowMs;
      tx.set(ref, {
        count: 1,
        windowMs,
        resetAt: new Date(newResetAt),
        updatedAt: new Date(now),
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: newResetAt,
        retryAfterSecs: 0,
      };
    }

    const count = typeof data.count === 'number' ? data.count : 0;
    if (count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSecs: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    tx.update(ref, {
      count: FieldValue.increment(1),
      updatedAt: new Date(now),
    });
    return {
      allowed: true,
      remaining: maxRequests - (count + 1),
      resetAt,
      retryAfterSecs: 0,
    };
  });
}
