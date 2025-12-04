/**
 * Webhook Signature Verification
 *
 * Verifies webhook signatures from external services to prevent:
 * - Spoofed webhooks triggering duplicate processing
 * - Malicious actors exhausting budget with fake completions
 * - Man-in-middle attacks
 *
 * Supports:
 * - HeyGen webhook signatures
 * - Submagic webhook signatures (if they implement them)
 * - Custom signature schemes
 */

import crypto from 'crypto';
import { Brand } from '@/config/constants';

// Get secrets from environment
const HEYGEN_WEBHOOK_SECRET = process.env.HEYGEN_WEBHOOK_SECRET;
const SUBMAGIC_WEBHOOK_SECRET = process.env.SUBMAGIC_WEBHOOK_SECRET;
// ENFORCE verification in production, allow bypass in dev/test only
const ENFORCE_VERIFICATION = process.env.NODE_ENV === 'production' || process.env.ENFORCE_WEBHOOK_VERIFICATION === 'true';

/**
 * Verify HeyGen webhook signature
 * HeyGen sends webhooks with X-HeyGen-Signature header
 * Signature = HMAC-SHA256(webhook_secret, request_body)
 */
export function verifyHeyGenWebhook(
  brand: string,
  rawBody: string,
  signature: string | null
): { valid: boolean; error?: string } {
  // If webhook verification is not enforced, skip
  if (!shouldEnforceWebhookVerification()) {
    console.warn('⚠️  Webhook verification is DISABLED - security risk!');
    return { valid: true };
  }

  // Check if webhook secret is configured FIRST
  // If no secret is set, we can't verify - allow through
  if (!HEYGEN_WEBHOOK_SECRET) {
    console.warn('⚠️  HEYGEN_WEBHOOK_SECRET not set - skipping verification');
    return { valid: true };
  }

  // Check if signature is provided
  if (!signature) {
    // HeyGen may not be sending signatures - log warning but allow through
    console.warn(`⚠️  [${brand}] HeyGen webhook has no signature header - allowing through`);
    return { valid: true };
  }

  try {
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', HEYGEN_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // Compare signatures (constant-time comparison to prevent timing attacks)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error(`❌ [${brand}] HeyGen webhook signature mismatch`);
      console.error(`   Expected: ${expectedSignature}`);
      console.error(`   Received: ${signature}`);
      return {
        valid: false,
        error: 'Invalid webhook signature',
      };
    }

    console.log(`✅ [${brand}] HeyGen webhook signature verified`);
    return { valid: true };

  } catch (error) {
    console.error('❌ Error verifying HeyGen webhook signature:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification error',
    };
  }
}

/**
 * Check if webhook verification should be enforced
 * Returns false in development mode or if explicitly disabled
 */
export function shouldEnforceWebhookVerification(): boolean {
  // Never enforce in development
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  // Check environment variable
  return ENFORCE_VERIFICATION;
}

/**
 * Verify Submagic webhook signature
 * Submagic webhook signature scheme (if they implement it):
 * Signature = HMAC-SHA256(webhook_secret, request_body)
 */
export function verifySubmagicWebhook(
  brand: string,
  rawBody: string,
  signature: string | null
): { valid: boolean; error?: string } {
  // If webhook verification is not enforced, skip
  if (!shouldEnforceWebhookVerification()) {
    return { valid: true };
  }

  // Check if signature is provided
  if (!signature) {
    // Submagic may not implement signatures yet - log warning
    console.warn(`⚠️  [${brand}] Submagic webhook has no signature header`);
    return { valid: true }; // Allow through for now
  }

  // Check if webhook secret is configured
  if (!SUBMAGIC_WEBHOOK_SECRET) {
    console.warn('⚠️  SUBMAGIC_WEBHOOK_SECRET not set - cannot verify signature');
    return { valid: true };
  }

  try {
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', SUBMAGIC_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // Compare signatures
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error(`❌ [${brand}] Submagic webhook signature mismatch`);
      return {
        valid: false,
        error: 'Invalid webhook signature',
      };
    }

    console.log(`✅ [${brand}] Submagic webhook signature verified`);
    return { valid: true };

  } catch (error) {
    console.error('❌ Error verifying Submagic webhook signature:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification error',
    };
  }
}

/**
 * Generate a webhook secret (for setup/rotation)
 * Returns a cryptographically secure random string
 */
export function generateWebhookSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate webhook timestamp to prevent replay attacks
 * Rejects webhooks older than 5 minutes
 */
export function validateWebhookTimestamp(
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes
): { valid: boolean; error?: string } {
  const now = Date.now();
  const age = now - timestamp;

  if (age < 0) {
    return {
      valid: false,
      error: 'Webhook timestamp is in the future',
    };
  }

  if (age > maxAgeMs) {
    return {
      valid: false,
      error: `Webhook is too old (${Math.round(age / 1000)}s old, max ${Math.round(maxAgeMs / 1000)}s)`,
    };
  }

  return { valid: true };
}
