#!/usr/bin/env npx tsx

/**
 * Manual trigger script to unstick workflows
 * Runs the failsafe cron jobs immediately
 */

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

async function triggerCron(path: string, name: string) {
  console.log(`\n🚀 Triggering ${name}...`);
  console.log(`   URL: ${BASE_URL}${path}`);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
        'User-Agent': 'vercel-cron/1.0'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`   ❌ Failed: ${response.status}`);
      console.error(`   Error:`, data);
      return false;
    }

    console.log(`   ✅ Success!`);
    console.log(`   Results:`, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    return false;
  }
}

async function main() {
  console.log('🔧 MANUAL WORKFLOW UNSTICK SCRIPT\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`CRON_SECRET: ${CRON_SECRET ? '✅ Set' : '❌ Missing'}\n`);

  if (!CRON_SECRET) {
    console.error('❌ CRON_SECRET environment variable is not set!');
    console.error('Please set it in your .env.local file or run:');
    console.error('   source .env.local && npx tsx scripts/unstick-workflows.ts');
    process.exit(1);
  }

  const crons = [
    { path: '/api/cron/check-stuck-heygen', name: 'HeyGen Failsafe' },
    { path: '/api/cron/check-stuck-submagic', name: 'Submagic Failsafe' },
    { path: '/api/cron/check-stuck-video-processing', name: 'Video Processing Failsafe' },
    { path: '/api/cron/check-stuck-posting', name: 'Posting Failsafe' }
  ];

  let successCount = 0;

  for (const cron of crons) {
    const success = await triggerCron(cron.path, cron.name);
    if (success) successCount++;

    // Wait 2 seconds between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n\n📊 SUMMARY`);
  console.log(`   Triggered: ${crons.length} cron jobs`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${crons.length - successCount}`);

  if (successCount === crons.length) {
    console.log(`\n✅ All failsafe cron jobs triggered successfully!`);
    console.log(`   Check your workflow dashboard to see if workflows are now unstuck.`);
  } else {
    console.log(`\n⚠️  Some cron jobs failed. Check the errors above.`);
  }
}

main().catch(console.error);
