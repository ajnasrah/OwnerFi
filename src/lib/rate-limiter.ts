/**
 * Simple in-memory rate limiter
 * For production, consider using Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entry
  if (entry && entry.resetAt < now) {
    rateLimitStore.delete(key);
  }

  const current = rateLimitStore.get(key);

  // First request in window
  if (!current) {
    const resetAt = now + (windowSeconds * 1000);
    rateLimitStore.set(key, {
      count: 1,
      resetAt
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt
    };
  }

  // Exceeded rate limit
  if (current.count >= maxRequests) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfter
    };
  }

  // Increment counter
  current.count++;
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetAt: current.resetAt
  };
}
