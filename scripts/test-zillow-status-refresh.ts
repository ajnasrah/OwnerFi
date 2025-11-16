/**
 * Test script for Zillow status refresh cron
 *
 * This simulates the cron job locally to verify it works before deploying
 *
 * Usage:
 *   npx tsx scripts/test-zillow-status-refresh.ts
 */

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testCron() {
  console.log('🧪 Testing Zillow status refresh cron job locally\n');

  // Get CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in .env.local');
    process.exit(1);
  }

  // Call the cron endpoint
  const url = 'http://localhost:3000/api/cron/refresh-zillow-status';

  console.log(`📡 Calling: ${url}\n`);
  console.log('⚠️  Make sure your dev server is running (npm run dev)\n');

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Cron job completed successfully!\n');
      console.log('Results:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Cron job failed:\n');
      console.error(JSON.stringify(data, null, 2));
    }

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Is your dev server running?');
      console.error('   Run: npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

testCron().catch(console.error);
