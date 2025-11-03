/**
 * Check Status of All 11 Workflows
 *
 * Workflow IDs triggered:
 * - Carz: wf_1762188576931_hkarrk702
 * - OwnerFi: wf_1762188588058_o72koe2bh
 * - VassDistro: wf_1762188642197_bm3uo1p0c
 * - Benefit: benefit_1762188678538_dd3tzwt2a
 * - Property: property_15sec_1762189720480_ryxih
 * - Podcast: podcast_1762189817891_hcayhg6eq
 * - Abdullah: 5 videos (wf_1762190062631_lsloxaaei, wf_1762190063323_6dho6b32p, wf_1762190063795_9qtfsfuju, wf_1762190064288_7n4b0uu0u, wf_1762190064698_srv63qxy8)
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin using environment variables
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Missing Firebase environment variables');
  }

  initializeApp({
    credential: cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = getFirestore();

const workflows = [
  { brand: 'Carz', collection: 'carz_workflow_queue', id: 'wf_1762188576931_hkarrk702' },
  { brand: 'OwnerFi', collection: 'ownerfi_workflow_queue', id: 'wf_1762188588058_o72koe2bh' },
  { brand: 'VassDistro', collection: 'vassdistro_workflow_queue', id: 'wf_1762188642197_bm3uo1p0c' },
  { brand: 'Benefit', collection: 'benefit_workflow_queue', id: 'benefit_1762188678538_dd3tzwt2a' },
  { brand: 'Property', collection: 'property_videos', id: 'property_15sec_1762189720480_ryxih' },
  { brand: 'Podcast', collection: 'podcast_workflow_queue', id: 'podcast_1762189817891_hcayhg6eq' },
  { brand: 'Abdullah-Mindset', collection: 'abdullah_workflow_queue', id: 'wf_1762190062631_lsloxaaei' },
  { brand: 'Abdullah-Business', collection: 'abdullah_workflow_queue', id: 'wf_1762190063323_6dho6b32p' },
  { brand: 'Abdullah-Money', collection: 'abdullah_workflow_queue', id: 'wf_1762190063795_9qtfsfuju' },
  { brand: 'Abdullah-Freedom', collection: 'abdullah_workflow_queue', id: 'wf_1762190064288_7n4b0uu0u' },
  { brand: 'Abdullah-Story', collection: 'abdullah_workflow_queue', id: 'wf_1762190064698_srv63qxy8' }
];

async function checkWorkflows() {
  console.log('\n📊 WORKFLOW STATUS CHECK');
  console.log('='.repeat(80));
  console.log(`Time: ${new Date().toLocaleTimeString()}\n`);

  const summary = {
    total: 0,
    pending: 0,
    heygen_processing: 0,
    submagic_processing: 0,
    posting: 0,
    completed: 0,
    failed: 0,
    with_platform_scheduling: 0,
    total_posts_scheduled: 0
  };

  for (const wf of workflows) {
    summary.total++;

    try {
      const doc = await db.collection(wf.collection).doc(wf.id).get();

      if (!doc.exists) {
        console.log(`❌ ${wf.brand}: NOT FOUND`);
        summary.failed++;
        continue;
      }

      const data = doc.data();
      const status = data?.status || 'unknown';

      // Status symbol
      let symbol = '⏳';
      if (status === 'completed') symbol = '✅';
      else if (status === 'failed') symbol = '❌';

      // Count by status
      if (status === 'pending') summary.pending++;
      else if (status === 'heygen_processing') summary.heygen_processing++;
      else if (status === 'submagic_processing') summary.submagic_processing++;
      else if (status === 'posting') summary.posting++;
      else if (status === 'completed') summary.completed++;
      else if (status === 'failed') summary.failed++;

      // Platform scheduling info
      const platformGroups = data?.platformGroups || 0;
      const scheduledPlatforms = data?.scheduledPlatforms || 0;

      if (platformGroups > 0) summary.with_platform_scheduling++;
      if (scheduledPlatforms > 0) summary.total_posts_scheduled += platformGroups;

      console.log(`${symbol} ${wf.brand.padEnd(20)} | Status: ${status.padEnd(20)} | HeyGen: ${data?.heygenVideoId ? '✓' : '✗'} | Submagic: ${data?.submagicVideoId ? '✓' : '✗'} | Groups: ${platformGroups} | Platforms: ${scheduledPlatforms}`);

      // Show platform posts if available
      if (data?.latePostId) {
        console.log(`   📱 Late Posts: ${data.latePostId}`);
      }

      if (data?.error) {
        console.log(`   ❌ Error: ${data.error}`);
      }

    } catch (error) {
      console.log(`❌ ${wf.brand}: ERROR - ${error instanceof Error ? error.message : 'Unknown'}`);
      summary.failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY\n');
  console.log(`Total Workflows: ${summary.total}`);
  console.log(`  ⏳ Pending: ${summary.pending}`);
  console.log(`  🎬 HeyGen Processing: ${summary.heygen_processing}`);
  console.log(`  ✂️  Submagic Processing: ${summary.submagic_processing}`);
  console.log(`  📤 Posting: ${summary.posting}`);
  console.log(`  ✅ Completed: ${summary.completed}`);
  console.log(`  ❌ Failed: ${summary.failed}`);
  console.log(`  🚀 With Platform Scheduling: ${summary.with_platform_scheduling}/${summary.completed}`);
  console.log(`  📱 Total Posts Scheduled: ${summary.total_posts_scheduled} (expected: ${summary.completed * 3})`);

  console.log('\n📋 EXPECTED RESULTS:');
  console.log(`  - Each completed video should have platformGroups: 3`);
  console.log(`  - Each completed video should have scheduledPlatforms: 5-8 (brand dependent)`);
  console.log(`  - Expected total posts: ${summary.completed} videos × 3 groups = ${summary.completed * 3} posts`);

  console.log('\n🔗 VERIFICATION:');
  console.log(`  - Late Dashboard: https://app.getlate.dev/posts?status=scheduled`);
  console.log(`  - Posting Times: 8 AM, 1 PM, 7 PM CST (tomorrow)\n`);

  process.exit(0);
}

checkWorkflows();
