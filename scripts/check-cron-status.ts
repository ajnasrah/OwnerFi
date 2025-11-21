import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Check status of Zillow scraper cron jobs
 */
async function checkCronStatus() {
  console.log('\n🔍 CRON JOB STATUS CHECK\n');
  console.log('='.repeat(80));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getlate.so';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in .env.local');
    console.log('   Cannot test cron endpoints without secret\n');
    return;
  }

  console.log(`Base URL: ${baseUrl}`);
  console.log(`CRON_SECRET: ${cronSecret.substring(0, 10)}...`);

  // Test endpoints
  const endpoints = [
    {
      name: 'Search Scraper (adds URLs to queue)',
      path: '/api/cron/run-search-scraper',
      schedule: 'Monday & Thursday @ 9 AM',
    },
    {
      name: 'Queue Processor (scrapes property details)',
      path: '/api/cron/process-scraper-queue',
      schedule: 'Every 2 hours (10, 12, 14, 16, 18, 20, 22)',
    },
  ];

  console.log('\n📋 CONFIGURED CRON JOBS:\n');

  for (const endpoint of endpoints) {
    console.log(`${endpoint.name}`);
    console.log(`  Path: ${endpoint.path}`);
    console.log(`  Schedule: ${endpoint.schedule}`);
    console.log(`  Test URL: ${baseUrl}${endpoint.path}?cron_secret=${cronSecret}`);
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('\n💡 TO TEST MANUALLY:\n');
  console.log(`curl "${baseUrl}/api/cron/run-search-scraper?cron_secret=${cronSecret}"`);
  console.log('\n   OR\n');
  console.log(`curl "${baseUrl}/api/cron/process-scraper-queue?cron_secret=${cronSecret}"`);
  console.log('\n');
}

checkCronStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
