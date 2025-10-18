// API utility functions for timeouts, retries, and error handling

import { TIMEOUTS, RETRY, RATE_LIMITS, ERROR_MESSAGES } from '@/config/constants';

// Legacy TIMEOUTS export for backward compatibility
export { TIMEOUTS };

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number, // seconds to wait
    public limit?: string // rate limit type (e.g., "per-minute", "per-hour")
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public serviceName: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * API timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// FETCH WITH ENHANCED ERROR HANDLING
// ============================================================================

/**
 * Fetch with timeout and rate limit detection
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

    // Check for rate limit (429 status)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      let retryAfterSeconds = 60; // default to 60 seconds

      if (retryAfter) {
        // Retry-After can be either:
        // 1. Number of seconds: "60"
        // 2. HTTP date: "Wed, 21 Oct 2015 07:28:00 GMT"
        const parsed = parseInt(retryAfter, 10);
        if (isNaN(parsed)) {
          // HTTP date format
          const retryDate = new Date(retryAfter);
          if (!isNaN(retryDate.getTime())) {
            retryAfterSeconds = Math.max(1, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
          }
        } else {
          // Seconds format
          retryAfterSeconds = parsed;
        }
      }

      throw new RateLimitError(
        ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        retryAfterSeconds,
        'api-rate-limit'
      );
    }

    // Check for service unavailable (503 status)
    if (response.status === 503) {
      throw new Error(ERROR_MESSAGES.API_UNAVAILABLE);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(
        `${ERROR_MESSAGES.API_TIMEOUT} (${timeout}ms)`,
        timeout
      );
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

// ============================================================================
// RETRY LOGIC WITH RATE LIMIT HANDLING
// ============================================================================

/**
 * Retry function with exponential backoff and rate limit handling
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = RETRY.DEFAULT_ATTEMPTS,
    backoff = 'exponential',
    initialDelay = RETRY.BACKOFF_BASE,
    maxDelay = RETRY.BACKOFF_MAX,
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

      // Don't retry on certain error types
      if (
        lastError.message.includes('401') || // Unauthorized
        lastError.message.includes('403') || // Forbidden
        lastError.message.includes('404') || // Not found
        lastError instanceof CircuitBreakerError // Circuit breaker open
      ) {
        throw lastError;
      }

      // Calculate delay
      let delay: number;

      // If rate limit error, use the retry-after header
      if (lastError instanceof RateLimitError && lastError.retryAfter) {
        delay = lastError.retryAfter * 1000; // Convert to milliseconds
        console.log(`⚠️ Rate limit hit. Waiting ${lastError.retryAfter}s before retry...`);
      } else if (backoff === 'exponential') {
        delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      } else {
        delay = Math.min(initialDelay * attempt, maxDelay);
      }

      // Add jitter (±20%) for non-rate-limit errors
      if (!(lastError instanceof RateLimitError)) {
        const jitter = delay * 0.2 * (Math.random() - 0.5);
        delay = Math.round(delay + jitter);
      }

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

// ============================================================================
// CIRCUIT BREAKER PATTERN
// ============================================================================

/**
 * Circuit breaker states
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private serviceName: string,
    private threshold: number = RATE_LIMITS.CIRCUIT_BREAKER_THRESHOLD,
    private timeout: number = RATE_LIMITS.CIRCUIT_BREAKER_TIMEOUT
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if timeout has elapsed
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.serviceName}. Service unavailable.`,
          this.serviceName
        );
      }
      // Try half-open state
      this.state = 'HALF_OPEN';
      console.log(`🔄 Circuit breaker for ${this.serviceName} entering HALF_OPEN state`);
    }

    try {
      const result = await fn();

      // Success - update state
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 2) {
          // Two successes in half-open = back to closed
          this.state = 'CLOSED';
          this.failures = 0;
          this.successCount = 0;
          console.log(`✅ Circuit breaker for ${this.serviceName} CLOSED (recovered)`);
        }
      } else {
        // Normal success in closed state
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.state === 'HALF_OPEN') {
        // Failure in half-open = back to open
        this.state = 'OPEN';
        this.successCount = 0;
        console.error(`❌ Circuit breaker for ${this.serviceName} reopened after failure`);
      } else if (this.failures >= this.threshold) {
        // Too many failures = open circuit
        this.state = 'OPEN';
        console.error(`🚨 Circuit breaker OPEN for ${this.serviceName} (${this.failures} failures)`);
      }

      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing/manual recovery)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    console.log(`🔄 Circuit breaker for ${this.serviceName} manually reset`);
  }
}

// Global circuit breakers for external services
export const circuitBreakers = {
  late: new CircuitBreaker('Late'),
  buffer: new CircuitBreaker('Buffer'),
  heygen: new CircuitBreaker('HeyGen'),
  submagic: new CircuitBreaker('Submagic'),
  openai: new CircuitBreaker('OpenAI'),
};

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
