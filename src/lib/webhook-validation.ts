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
    
    // Handle different signature formats (hex, base64, etc.)
    let normalizedSignature = signature;
    if (signature.startsWith('sha256=')) {
      normalizedSignature = signature.substring(7);
    } else if (signature.startsWith('sha1=')) {
      normalizedSignature = signature.substring(5);
    }
    
    // Convert both to same encoding for comparison
    const sigBuffer = Buffer.from(normalizedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    // Ensure buffers are same length for timing-safe comparison
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return false;
  }
}