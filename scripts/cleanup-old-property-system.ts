#!/usr/bin/env tsx
/**
 * Cleanup Old Property Video System
 *
 * Deletes ALL old workflow data from the broken 3-collection system:
 * 1. property_rotation_queue (388 entries)
 * 2. property_videos (817 entries - 776 stuck pending)
 * 3. propertyShowcaseWorkflows (0 entries - but included for completeness)
 *
 * This prepares for the new simplified single-collection system.
 *
 * DESTRUCTIVE: Run with --confirm flag
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function cleanup() {
  const args = process.argv.slice(2);
  const confirmed = args.includes('--confirm');

  console.log('🧹 Property Video System Cleanup\n');
  console.log('='.repeat(70));
  console.log('\n⚠️  WARNING: This will DELETE ALL data from:');
  console.log('   - property_rotation_queue');
  console.log('   - property_videos');
  console.log('   - propertyShowcaseWorkflows');
  console.log('\nThis is IRREVERSIBLE and will wipe all workflow history!');
  console.log('\nThe properties collection will NOT be touched.');

  if (!confirmed) {
    console.log('\n❌ Aborted: Run with --confirm flag to proceed');
    console.log('   Example: npx tsx scripts/cleanup-old-property-system.ts --confirm');
    return;
  }

  console.log('\n✅ Confirmed. Starting cleanup in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return;
  }

  let totalDeleted = 0;

  // 1. Delete property_rotation_queue
  console.log('\n📋 Deleting property_rotation_queue...');
  const rotationQueue = await db.collection('property_rotation_queue').get();
  console.log(`   Found ${rotationQueue.size} entries`);

  if (rotationQueue.size > 0) {
    const batch1 = db.batch();
    let count1 = 0;

    for (const doc of rotationQueue.docs) {
      batch1.delete(doc.ref);
      count1++;

      // Firestore batch limit is 500
      if (count1 % 500 === 0) {
        await batch1.commit();
        console.log(`   Deleted ${count1}/${rotationQueue.size}...`);
      }
    }

    if (count1 % 500 !== 0) {
      await batch1.commit();
    }

    console.log(`   ✅ Deleted ${count1} entries from property_rotation_queue`);
    totalDeleted += count1;
  }

  // 2. Delete property_videos
  console.log('\n📹 Deleting property_videos...');
  const propertyVideos = await db.collection('property_videos').get();
  console.log(`   Found ${propertyVideos.size} entries`);

  if (propertyVideos.size > 0) {
    const batch2 = db.batch();
    let count2 = 0;

    for (const doc of propertyVideos.docs) {
      batch2.delete(doc.ref);
      count2++;

      if (count2 % 500 === 0) {
        await batch2.commit();
        console.log(`   Deleted ${count2}/${propertyVideos.size}...`);
      }
    }

    if (count2 % 500 !== 0) {
      await batch2.commit();
    }

    console.log(`   ✅ Deleted ${count2} entries from property_videos`);
    totalDeleted += count2;
  }

  // 3. Delete propertyShowcaseWorkflows (should be empty, but check anyway)
  console.log('\n🎬 Deleting propertyShowcaseWorkflows...');
  const showcaseWorkflows = await db.collection('propertyShowcaseWorkflows').get();
  console.log(`   Found ${showcaseWorkflows.size} entries`);

  if (showcaseWorkflows.size > 0) {
    const batch3 = db.batch();
    let count3 = 0;

    for (const doc of showcaseWorkflows.docs) {
      batch3.delete(doc.ref);
      count3++;

      if (count3 % 500 === 0) {
        await batch3.commit();
        console.log(`   Deleted ${count3}/${showcaseWorkflows.size}...`);
      }
    }

    if (count3 % 500 !== 0) {
      await batch3.commit();
    }

    console.log(`   ✅ Deleted ${count3} entries from propertyShowcaseWorkflows`);
    totalDeleted += count3;
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('✅ Cleanup Complete!');
  console.log('='.repeat(70));
  console.log(`Total documents deleted: ${totalDeleted}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Run: npx tsx scripts/populate-new-property-queue.ts');
  console.log('   2. Test with: curl -X POST /api/property/video-cron (with auth)');
  console.log();
}

cleanup().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
