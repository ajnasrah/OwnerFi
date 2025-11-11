/**
 * 2-Day Platform Scheduling Test Plan
 *
 * This script helps test the new platform-specific scheduling system.
 *
 * Day 1: Verify all workflows create 3 scheduled posts per video
 * Day 2: Monitor that all posts go live at their optimal times
 *
 * Usage:
 *   npx tsx scripts/test-platform-scheduling.ts --day 1
 *   npx tsx scripts/test-platform-scheduling.ts --day 2
 *   npx tsx scripts/test-platform-scheduling.ts --validate-config
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getPlatformGroups, validatePlatformGroups, getScheduleDescription } from '../src/lib/platform-scheduling';
import { getAllBrandIds } from '../src/lib/brand-utils';
import { Brand } from '../src/config/constants';

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ FIREBASE_PROJECT_ID not set in environment');
  process.exit(1);
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

try {
  initializeApp({
    credential: cert(serviceAccount as any),
  });
} catch (error) {
  console.log('Firebase already initialized or error:', error);
}

const db = getFirestore();

/**
 * Validate platform group configuration for all brands
 */
async function validateConfiguration() {
  console.log('🔍 Validating Platform Group Configuration\n');
  console.log('='.repeat(80));

  const brands = getAllBrandIds();
  let allValid = true;

  for (const brand of brands) {
    console.log(`\n📊 ${brand.toUpperCase()}`);
    console.log('-'.repeat(80));

    // Get platform groups
    const groups = getPlatformGroups(brand as Brand);

    console.log(`   Platform Groups: ${groups.length}`);
    for (const group of groups) {
      const timeStr = `${group.hourCST % 12 || 12}${group.hourCST >= 12 ? 'PM' : 'AM'} CST`;
      console.log(`   • ${group.label} (${timeStr})`);
      console.log(`     Platforms: ${group.platforms.join(', ')}`);
      console.log(`     ${group.description}`);
    }

    // Validate all platforms are covered
    const validation = validatePlatformGroups(brand as Brand);

    if (validation.valid) {
      console.log(`   ✅ All ${validation.coveredPlatforms.length} platforms covered`);
    } else {
      console.log(`   ❌ MISSING PLATFORMS: ${validation.missingPlatforms.join(', ')}`);
      allValid = false;
    }

    // Show schedule description
    console.log(`\n   📅 ${getScheduleDescription(brand as Brand)}`);
  }

  console.log('\n' + '='.repeat(80));

  if (allValid) {
    console.log('✅ Configuration Valid - All brands have complete platform coverage');
  } else {
    console.log('❌ Configuration Invalid - Some brands have missing platforms');
    process.exit(1);
  }
}

/**
 * Day 1 Test: Verify scheduled posts were created
 */
async function testDay1() {
  console.log('📅 DAY 1 TEST: Verify Scheduled Posts Created\n');
  console.log('='.repeat(80));

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  console.log(`\nAnalyzing workflows completed today:`);
  console.log(`From: ${startOfDay.toISOString()}`);
  console.log(`To:   ${endOfDay.toISOString()}\n`);

  const brands = getAllBrandIds();
  const brandResults: Record<string, any> = {};

  for (const brand of brands) {
    console.log(`\n📊 ${brand.toUpperCase()}`);
    console.log('-'.repeat(80));

    // Get collection name for this brand
    let collectionName: string;
    if (brand === 'carz') collectionName = 'carz_workflow_queue';
    else if (brand === 'ownerfi') collectionName = 'ownerfi_workflow_queue';
    else if (brand === 'podcast') collectionName = 'podcast_workflow_queue';
    else if (brand === 'benefit') collectionName = 'benefit_workflow_queue';
    else if (brand === 'property') collectionName = 'property_videos';
    else if (brand === 'vassdistro') collectionName = 'vassdistro_workflow_queue';
    else if (brand === 'abdullah') collectionName = 'abdullah_workflow_queue';
    else continue;

    // Query completed workflows from today
    const snapshot = await db
      .collection(collectionName)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', startOfDay.getTime())
      .where('completedAt', '<=', endOfDay.getTime())
      .get();

    const workflows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`   Completed workflows today: ${workflows.length}`);

    if (workflows.length === 0) {
      console.log(`   ⚠️  No workflows completed yet - check back after cron runs`);
      brandResults[brand] = { count: 0, valid: null };
      continue;
    }

    // Check each workflow
    let validCount = 0;
    let invalidCount = 0;

    for (const workflow of workflows) {
      const hasGroups = workflow.platformGroups > 0;
      const hasScheduled = workflow.scheduledPlatforms > 0;

      if (hasGroups && hasScheduled) {
        validCount++;
        console.log(`   ✅ ${workflow.id}: ${workflow.platformGroups} groups, ${workflow.scheduledPlatforms} platforms`);
      } else {
        invalidCount++;
        console.log(`   ❌ ${workflow.id}: Missing scheduling data`);
        console.log(`      platformGroups: ${workflow.platformGroups || 'undefined'}`);
        console.log(`      scheduledPlatforms: ${workflow.scheduledPlatforms || 'undefined'}`);
      }
    }

    const percentage = ((validCount / workflows.length) * 100).toFixed(1);
    console.log(`\n   Summary: ${validCount}/${workflows.length} (${percentage}%) have valid scheduling`);

    brandResults[brand] = {
      count: workflows.length,
      valid: validCount,
      invalid: invalidCount,
      percentage: parseFloat(percentage),
    };
  }

  // Overall summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 OVERALL DAY 1 RESULTS\n');

  const totalWorkflows = Object.values(brandResults).reduce((sum: number, r: any) => sum + r.count, 0);
  const totalValid = Object.values(brandResults).reduce((sum: number, r: any) => sum + (r.valid || 0), 0);
  const totalInvalid = Object.values(brandResults).reduce((sum: number, r: any) => sum + (r.invalid || 0), 0);

  console.log(`Total workflows: ${totalWorkflows}`);
  console.log(`Valid scheduling: ${totalValid}`);
  console.log(`Invalid/Missing: ${totalInvalid}`);

  if (totalWorkflows > 0) {
    const overallPercentage = ((totalValid / totalWorkflows) * 100).toFixed(1);
    console.log(`Success rate: ${overallPercentage}%`);

    if (parseFloat(overallPercentage) >= 95) {
      console.log('\n✅ DAY 1 TEST PASSED - Platform scheduling working correctly');
    } else {
      console.log('\n⚠️  DAY 1 TEST WARNING - Some workflows missing scheduling data');
      console.log('   This could mean:');
      console.log('   1. New code not deployed yet');
      console.log('   2. Workflows created before deployment');
      console.log('   3. Actual bug in scheduling logic');
    }
  } else {
    console.log('\n⏳ DAY 1 TEST INCOMPLETE - No workflows completed yet');
    console.log('   Wait for cron jobs to run and try again');
  }
}

/**
 * Day 2 Test: Check that posts are going live at correct times
 */
async function testDay2() {
  console.log('📅 DAY 2 TEST: Monitor Post Publishing Times\n');
  console.log('='.repeat(80));

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  console.log(`\nMonitoring posts scheduled for today:`);
  console.log(`Date: ${startOfDay.toLocaleDateString()}\n`);

  console.log('Expected posting times (CST):');
  console.log('   8:00 AM - Professional platforms (LinkedIn, Twitter, Bluesky)');
  console.log('   1:00 PM - Midday platforms (Facebook, YouTube)');
  console.log('   7:00 PM - Evening platforms (TikTok, Instagram, Threads)\n');

  console.log('Current time:', new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'full',
    timeStyle: 'long'
  }));

  console.log('\n⚠️  Note: This test requires manual verification');
  console.log('   1. Check Late.dev dashboard at 8 AM, 1 PM, and 7 PM CST');
  console.log('   2. Verify posts go live at expected times');
  console.log('   3. Monitor engagement on each platform');
  console.log('   4. Check for any failed or delayed posts\n');

  console.log('To view scheduled posts in Late.dev:');
  console.log('   https://app.getlate.dev/posts?status=scheduled\n');

  console.log('To check workflow completions:');
  console.log('   npx tsx scripts/test-platform-scheduling.ts --day 1\n');
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--validate-config')) {
    await validateConfiguration();
  } else if (args.includes('--day')) {
    const dayIndex = args.indexOf('--day');
    const day = args[dayIndex + 1];

    if (day === '1') {
      await testDay1();
    } else if (day === '2') {
      await testDay2();
    } else {
      console.error('❌ Invalid day. Use --day 1 or --day 2');
      process.exit(1);
    }
  } else {
    console.log('Platform Scheduling Test Suite\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/test-platform-scheduling.ts --validate-config');
    console.log('  npx tsx scripts/test-platform-scheduling.ts --day 1');
    console.log('  npx tsx scripts/test-platform-scheduling.ts --day 2');
    console.log('\nCommands:');
    console.log('  --validate-config   Verify platform groups for all brands');
    console.log('  --day 1            Check completed workflows have scheduling data');
    console.log('  --day 2            Monitor post publishing (manual verification)\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
