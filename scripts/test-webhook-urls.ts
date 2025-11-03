/**
 * Test what webhook URLs are being generated
 */

import { getBrandWebhookUrl } from '../src/lib/brand-utils';

console.log('🔍 Testing webhook URL generation...\n');

const brands = ['carz', 'ownerfi', 'vassdistro'] as const;

for (const brand of brands) {
  const heygenWebhook = getBrandWebhookUrl(brand, 'heygen');
  const submagicWebhook = getBrandWebhookUrl(brand, 'submagic');

  console.log(`Brand: ${brand.toUpperCase()}`);
  console.log(`HeyGen Webhook:  ${heygenWebhook}`);
  console.log(`Submagic Webhook: ${submagicWebhook}`);
  console.log('---\n');
}

// Check environment variables
console.log('📝 Environment Variables:');
console.log(`NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL || 'NOT SET'}`);
console.log(`VERCEL_URL: ${process.env.VERCEL_URL || 'NOT SET'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
