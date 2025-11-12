/**
 * Fetch with Timeout and Retry Logic
 *
 * Provides timeout handling and retry logic for external API calls.
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RetryExhaustedError extends Error {
  constructor(message: string, public lastError: Error) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Fetch with timeout support using AbortController
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 seconds default
    retries = 0,
    retryDelay = 1000,
    onRetry,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // If this is a retry, wait before attempting
    if (attempt > 0) {
      const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
      onRetry?.(attempt, lastError!);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);

        // Check if it was a timeout (AbortError)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError(`Request to ${url} timed out after ${timeout}ms`);
        }

        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (error instanceof TimeoutError && attempt < retries) {
        continue; // Retry on timeout
      }

      if (error instanceof TypeError && attempt < retries) {
        continue; // Retry on network errors
      }

      // If this was the last attempt or error is not retryable, throw
      if (attempt === retries) {
        if (retries > 0) {
          throw new RetryExhaustedError(
            `Failed after ${retries + 1} attempts`,
            lastError
          );
        }
        throw lastError;
      }
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error('Unknown error in fetchWithTimeout');
}

/**
 * Fetch with automatic retry on specific status codes
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions & {
    retryOn?: number[];
  } = {}
): Promise<Response> {
  const {
    retryOn = [408, 429, 500, 502, 503, 504],
    ...fetchOptions
  } = options;

  const response = await fetchWithTimeout(url, {
    ...fetchOptions,
    retries: 0, // We handle retries ourselves
  });

  // Check if we should retry based on status code
  if (retryOn.includes(response.status) && (fetchOptions.retries || 0) > 0) {
    return fetchWithTimeout(url, fetchOptions);
  }

  return response;
}

/**
 * Default timeouts for different services
 */
export const ServiceTimeouts = {
  HEYGEN: 60000,        // 60 seconds for video generation
  SUBMAGIC: 120000,     // 2 minutes for video processing
  STRIPE: 30000,        // 30 seconds for payment processing
  GOOGLE_MAPS: 10000,   // 10 seconds for geocoding
  OPENAI: 60000,        // 60 seconds for AI generation
  FIREBASE: 30000,      // 30 seconds for database operations
  DEFAULT: 30000,       // 30 seconds default
};
