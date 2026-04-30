import crypto from 'crypto';

/**
 * Validate webhook signature from external services
 */
export async function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): Promise<boolean> {
  try {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return false;
  }
}