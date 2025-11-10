#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function testAnalyticsAddon() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('Testing Late.dev Analytics Add-on...\n');

  try {
    // Try to fetch analytics for a published post
    const response = await fetch('https://getlate.dev/api/v1/analytics?limit=1', {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status:', response.status);
    console.log('Rate Limit Headers:');
    console.log('  X-RateLimit-Limit:', response.headers.get('x-ratelimit-limit'));
    console.log('  X-RateLimit-Remaining:', response.headers.get('x-ratelimit-remaining'));
    console.log('  X-RateLimit-Reset:', response.headers.get('x-ratelimit-reset'));
    console.log('');

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 402) {
      console.log('\n❌ ANALYTICS ADD-ON NOT ENABLED');
      console.log('You need to purchase the Analytics add-on from Late.dev to access analytics data.');
      console.log('Contact Late.dev support or check your dashboard.');
    } else if (response.status === 200) {
      console.log('\n✅ ANALYTICS ADD-ON IS ENABLED');
      console.log('Analytics data is available!');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testAnalyticsAddon().catch(console.error);
