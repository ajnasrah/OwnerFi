/**
 * Firestore-based Distributed Rate Limiter
 *
 * Uses Firestore for rate limit state, making it work across
 * distributed serverless instances (Vercel, etc.)
 *
 * Collection: rate_limits
 * Document ID: {key}
 * Fields: count, resetAt, updatedAt
 */

import { db } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const RATE_LIMIT_COLLECTION = 'rate_limits';

interface RateLimitDoc {
  count: number;
  resetAt: number; // Unix timestamp ms
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Check and increment rate limit atomically using Firestore transaction
 * @param key - Unique identifier for rate limit (e.g., "ip:1.2.3.4" or "user:abc123")
 * @param maxRequests - Maximum requests allowed in window
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit status
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  const now = Date.now();
  const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(key);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const data = doc.data() as RateLimitDoc | undefined;

      // If no document or window expired, start fresh
      if (!data || data.resetAt < now) {
        const resetAt = now + (windowSeconds * 1000);
        transaction.set(docRef, {
          count: 1,
          resetAt,
          updatedAt: FieldValue.serverTimestamp()
        });
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetAt
        };
      }

      // Check if limit exceeded
      if (data.count >= maxRequests) {
        const retryAfter = Math.ceil((data.resetAt - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetAt: data.resetAt,
          retryAfter
        };
      }

      // Increment counter
      const newCount = data.count + 1;
      transaction.update(docRef, {
        count: newCount,
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        allowed: true,
        remaining: maxRequests - newCount,
        resetAt: data.resetAt
      };
    });

    return result;
  } catch (error) {
    console.error('[RateLimiter] Firestore error:', error);
    // On error, allow the request (fail open) but log
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + (windowSeconds * 1000)
    };
  }
}

/**
 * Check rate limit without incrementing (read-only check)
 * @param key - Rate limit key
 * @param maxRequests - Maximum requests allowed
 * @returns Current rate limit status
 */
export async function checkRateLimitStatus(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; used: number }> {
  const now = Date.now();
  const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(key);

  try {
    const doc = await docRef.get();
    const data = doc.data() as RateLimitDoc | undefined;

    if (!data || data.resetAt < now) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: now + (windowSeconds * 1000),
        used: 0
      };
    }

    return {
      allowed: data.count < maxRequests,
      remaining: Math.max(0, maxRequests - data.count),
      resetAt: data.resetAt,
      used: data.count
    };
  } catch (error) {
    console.error('[RateLimiter] Error checking status:', error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + (windowSeconds * 1000),
      used: 0
    };
  }
}

/**
 * Reset rate limit for a key
 * @param key - Rate limit key to reset
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.collection(RATE_LIMIT_COLLECTION).doc(key).delete();
    console.log(`[RateLimiter] Reset rate limit for ${key}`);
  } catch (error) {
    console.error('[RateLimiter] Error resetting:', error);
  }
}

/**
 * Clean up expired rate limit documents (run periodically via cron)
 * @returns Number of documents cleaned up
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const now = Date.now();

  try {
    const snapshot = await db
      .collection(RATE_LIMIT_COLLECTION)
      .where('resetAt', '<', now)
      .limit(500) // Batch size
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[RateLimiter] Cleaned up ${snapshot.size} expired entries`);
    return snapshot.size;
  } catch (error) {
    console.error('[RateLimiter] Error cleaning up:', error);
    return 0;
  }
}

/**
 * Get rate limit headers for HTTP responses
 * @param status - Rate limit status from rateLimit()
 * @returns HTTP headers object
 */
export function getRateLimitHeaders(status: {
  remaining: number;
  resetAt: number;
  allowed?: boolean;
}): Record<string, string> {
  return {
    'X-RateLimit-Remaining': status.remaining.toString(),
    'X-RateLimit-Reset': new Date(status.resetAt).toISOString(),
    ...(status.allowed === false && {
      'Retry-After': Math.ceil((status.resetAt - Date.now()) / 1000).toString()
    })
  };
}

/**
 * Common rate limit presets
 */
export const RateLimitPresets = {
  // API endpoints
  API_DEFAULT: { maxRequests: 100, windowSeconds: 60 },      // 100/min
  API_STRICT: { maxRequests: 20, windowSeconds: 60 },        // 20/min
  API_RELAXED: { maxRequests: 300, windowSeconds: 60 },      // 300/min

  // Webhooks
  WEBHOOK: { maxRequests: 1000, windowSeconds: 60 },         // 1000/min

  // Authentication
  AUTH_LOGIN: { maxRequests: 5, windowSeconds: 300 },        // 5/5min
  AUTH_SIGNUP: { maxRequests: 3, windowSeconds: 3600 },      // 3/hour

  // External APIs (budget protection)
  HEYGEN: { maxRequests: 50, windowSeconds: 3600 },          // 50/hour
  SUBMAGIC: { maxRequests: 30, windowSeconds: 3600 },        // 30/hour
  OPENAI: { maxRequests: 100, windowSeconds: 60 },           // 100/min
};

/**
 * Create rate limit key from request
 * @param identifier - User ID, IP, or API key
 * @param endpoint - Optional endpoint for granular limiting
 * @returns Rate limit key
 */
export function createRateLimitKey(
  identifier: string,
  endpoint?: string
): string {
  if (endpoint) {
    return `${identifier}:${endpoint}`;
  }
  return identifier;
}
