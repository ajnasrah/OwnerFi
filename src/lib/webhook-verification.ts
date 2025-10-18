/**
 * Webhook Signature Verification
 *
 * Verifies webhook requests from external services to prevent spoofing.
 */

import { createHmac } from 'crypto';

/**
 * Verify HeyGen webhook signature
 *
 * HeyGen sends a signature in the X-HeyGen-Signature header.
 * The signature is an HMAC-SHA256 hash of the request body using the webhook secret.
 *
 * @param body - Raw request body (string or object)
 * @param signature - Signature from X-HeyGen-Signature header
 * @param secret - Webhook secret from HeyGen
 * @returns True if signature is valid
 */
export function verifyHeyGenSignature(
  body: string | object,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Convert body to string if it's an object
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

    // Create HMAC-SHA256 hash
    const hmac = createHmac('sha256', secret);
    hmac.update(bodyString);
    const calculatedSignature = hmac.digest('hex');

    // Compare signatures (timing-safe comparison)
    return timingSafeEqual(signature, calculatedSignature);
  } catch (error) {
    console.error('Error verifying HeyGen signature:', error);
    return false;
  }
}

/**
 * Verify Submagic webhook signature (if they provide one)
 *
 * Note: Submagic may not provide webhook signatures. Check their docs.
 * This is a placeholder for future implementation.
 *
 * @param body - Raw request body
 * @param signature - Signature header
 * @param secret - Webhook secret
 * @returns True if signature is valid
 */
export function verifySubmagicSignature(
  body: string | object,
  signature: string | null,
  secret: string
): boolean {
  // TODO: Implement if Submagic provides webhook signatures
  // For now, we rely on callback_id verification
  return true;
}

/**
 * Timing-safe string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Get HeyGen webhook secret for a brand from environment
 *
 * @param brand - Brand identifier
 * @returns Webhook secret or null
 */
export function getHeyGenWebhookSecret(brand: 'carz' | 'ownerfi' | 'podcast'): string | null {
  const envVar = `HEYGEN_WEBHOOK_SECRET_${brand.toUpperCase()}`;
  return process.env[envVar] || null;
}

/**
 * Middleware to verify HeyGen webhook requests
 *
 * @param brand - Brand identifier
 * @param body - Request body
 * @param signature - Signature from header
 * @returns Verification result with error message if invalid
 */
export function verifyHeyGenWebhook(
  brand: 'carz' | 'ownerfi' | 'podcast',
  body: string | object,
  signature: string | null
): { valid: boolean; error?: string } {
  // Get webhook secret for brand
  const secret = getHeyGenWebhookSecret(brand);

  if (!secret) {
    // If no secret configured, log warning but allow request
    // This maintains backwards compatibility
    console.warn(`⚠️  No HeyGen webhook secret configured for ${brand}. Skipping signature verification.`);
    return { valid: true };
  }

  if (!signature) {
    return {
      valid: false,
      error: 'Missing X-HeyGen-Signature header',
    };
  }

  const isValid = verifyHeyGenSignature(body, signature, secret);

  if (!isValid) {
    return {
      valid: false,
      error: 'Invalid webhook signature',
    };
  }

  return { valid: true };
}

/**
 * Check if webhook verification should be enforced
 *
 * In development, we may want to skip verification for testing.
 *
 * @returns True if verification should be enforced
 */
export function shouldEnforceWebhookVerification(): boolean {
  // Allow bypass in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_WEBHOOK_VERIFICATION === 'true') {
    return false;
  }

  // Always enforce in production
  return true;
}
