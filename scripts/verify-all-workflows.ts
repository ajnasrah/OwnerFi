#!/usr/bin/env tsx
/**
 * Comprehensive Workflow Verification Script
 * Checks all brands for stuck/failed workflows across all stages
 */

import { getAdminDb } from '../src/lib/firebase-admin';

interface WorkflowCheck {
  brand: string;
  collection: string;
  stuck: {
    heygen_processing: number;
    submagic_processing: number;
    posting: number;
  };
  failed: number;
  total: number;
}

const BRAND_COLLECTIONS = [
  { brand: 'benefit', collection: 'benefit_workflow_queue' },
  { brand: 'property', collection: 'property_videos' },
  { brand: 'carz', collection: 'carz_workflow_queue' },
  { brand: 'ownerfi', collection: 'ownerfi_workflow_queue' },
  { brand: 'podcast', collection: 'podcast_workflow_queue' },
  { brand: 'abdullah', collection: 'abdullah_workflow_queue' },
  { brand: 'vassdistro', collection: 'vassdistro_workflow_queue' },
];

async function checkBrand(adminDb: any, brandInfo: { brand: string; collection: string }): Promise<WorkflowCheck> {
  const { brand, collection } = brandInfo;
  const result: WorkflowCheck = {
    brand,
    collection,
    stuck: {
      heygen_processing: 0,
      submagic_processing: 0,
      posting: 0,
    },
    failed: 0,
    total: 0,
  };

  try {
    // Check HeyGen processing (stuck > 30 min)
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    const heygenStuck = await adminDb
      .collection(collection)
      .where('status', '==', 'heygen_processing')
      .where('createdAt', '<', thirtyMinAgo)
      .get();
    result.stuck.heygen_processing = heygenStuck.size;

    // Check Submagic processing (stuck > 30 min)
    const submagicStuck = await adminDb
      .collection(collection)
      .where('status', '==', 'submagic_processing')
      .where('createdAt', '<', thirtyMinAgo)
      .get();
    result.stuck.submagic_processing = submagicStuck.size;

    // Check posting (stuck > 30 min)
    const postingStuck = await adminDb
      .collection(collection)
      .where('status', '==', 'posting')
      .where('createdAt', '<', thirtyMinAgo)
      .get();
    result.stuck.posting = postingStuck.size;

    // Check failed
    const failed = await adminDb
      .collection(collection)
      .where('status', '==', 'failed')
      .get();
    result.failed = failed.size;

    result.total = result.stuck.heygen_processing +
                   result.stuck.submagic_processing +
                   result.stuck.posting +
                   result.failed;

  } catch (error) {
    console.error(`   ❌ Error checking ${brand}:`, error instanceof Error ? error.message : error);
  }

  return result;
}

async function main() {
  console.log('🔍 Comprehensive Workflow Verification\n');
  console.log('═'.repeat(70));

  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized');
    process.exit(1);
  }

  const results: WorkflowCheck[] = [];

  for (const brandInfo of BRAND_COLLECTIONS) {
    console.log(`\n📋 Checking ${brandInfo.brand}...`);
    const result = await checkBrand(adminDb, brandInfo);
    results.push(result);

    if (result.total > 0) {
      console.log(`   ⚠️  Found ${result.total} issues:`);
      if (result.stuck.heygen_processing > 0) {
        console.log(`      - ${result.stuck.heygen_processing} stuck in HeyGen processing`);
      }
      if (result.stuck.submagic_processing > 0) {
        console.log(`      - ${result.stuck.submagic_processing} stuck in Submagic processing`);
      }
      if (result.stuck.posting > 0) {
        console.log(`      - ${result.stuck.posting} stuck in posting`);
      }
      if (result.failed > 0) {
        console.log(`      - ${result.failed} failed`);
      }
    } else {
      console.log(`   ✅ No stuck or failed workflows`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 Summary:\n');

  const totalStuckHeygen = results.reduce((sum, r) => sum + r.stuck.heygen_processing, 0);
  const totalStuckSubmagic = results.reduce((sum, r) => sum + r.stuck.submagic_processing, 0);
  const totalStuckPosting = results.reduce((sum, r) => sum + r.stuck.posting, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalIssues = results.reduce((sum, r) => sum + r.total, 0);

  console.log(`   Stuck in HeyGen:    ${totalStuckHeygen}`);
  console.log(`   Stuck in Submagic:  ${totalStuckSubmagic}`);
  console.log(`   Stuck in Posting:   ${totalStuckPosting}`);
  console.log(`   Failed:             ${totalFailed}`);
  console.log(`   ──────────────────────────────`);
  console.log(`   Total Issues:       ${totalIssues}`);

  if (totalIssues === 0) {
    console.log('\n✅ All workflows are healthy!');
  } else {
    console.log('\n⚠️  Issues detected - review above for details');
  }

  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
