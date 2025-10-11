// API utility functions for timeouts, retries, and error handling

export const TIMEOUTS = {
  RSS_FETCH: 5000,        // 5 seconds
  OPENAI_GENERATE: 15000, // 15 seconds
  HEYGEN_SUBMIT: 10000,   // 10 seconds
  SUBMAGIC_SUBMIT: 10000, // 10 seconds
  WORKFLOW_TTL: 10800000, // 3 hours
};

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  backoff?: 'linear' | 'exponential';
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    backoff = 'exponential',
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = config;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Calculate delay
      let delay: number;
      if (backoff === 'exponential') {
        delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      } else {
        delay = Math.min(initialDelay * attempt, maxDelay);
      }

      // Add jitter (±20%)
      const jitter = delay * 0.2 * (Math.random() - 0.5);
      delay = Math.round(delay + jitter);

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms:`, lastError.message);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Error response helper
 */
export function createErrorResponse(
  message: string,
  details?: string,
  statusCode: number = 500
) {
  return {
    error: message,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Rate limiter using simple token bucket
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  tryConsume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Rate limiters for different APIs
export const rateLimiters = {
  openai: new TokenBucket(10, 1),    // 10 requests/burst, 1/sec sustained
  heygen: new TokenBucket(5, 0.5),   // 5 requests/burst, 0.5/sec sustained
  submagic: new TokenBucket(5, 0.5), // 5 requests/burst, 0.5/sec sustained
};

/**
 * Check rate limit before making request
 */
export function checkRateLimit(limiter: TokenBucket): boolean {
  return limiter.tryConsume();
}
