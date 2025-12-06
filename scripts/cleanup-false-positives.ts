import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasNegativeFinancing, detectNegativeFinancing } from '../src/lib/negative-financing-detector';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

interface CleanupResult {
  id: string;
  address: string;
  reason: string;
  matchedPattern?: string;
  action: 'deactivated' | 'deleted' | 'skipped';
}

async function cleanupFalsePositives(dryRun: boolean = true) {
  console.log('\n🧹 FALSE POSITIVE CLEANUP SCRIPT\n');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE MODE (will modify data)'}`);
  console.log('');

  // Get ALL properties with ownerFinanceVerified = true
  const snapshot = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  console.log(`📦 Found ${snapshot.size} verified properties to check\n`);

  const results: CleanupResult[] = [];
  let negativeCount = 0;
  let noKeywordCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const desc = data.description;
    const address = data.fullAddress || data.address || 'Unknown address';

    // Check 1: Has negative financing indicators
    const negResult = detectNegativeFinancing(desc);
    if (negResult.isNegative) {
      negativeCount++;

      if (!dryRun) {
        // Set ownerFinanceVerified to false and isActive to false
        await doc.ref.update({
          ownerFinanceVerified: false,
          isActive: false,
          deactivatedAt: new Date().toISOString(),
          deactivatedReason: `False positive: ${negResult.reason}`,
        });
      }

      results.push({
        id: doc.id,
        address,
        reason: negResult.reason,
        matchedPattern: negResult.matchedPattern,
        action: dryRun ? 'skipped' : 'deactivated',
      });
      continue;
    }

    // Check 2: Doesn't pass strict filter (no owner financing keywords)
    const filterResult = hasStrictOwnerFinancing(desc);
    if (!filterResult.passes) {
      noKeywordCount++;

      if (!dryRun) {
        await doc.ref.update({
          ownerFinanceVerified: false,
          isActive: false,
          deactivatedAt: new Date().toISOString(),
          deactivatedReason: 'No owner financing keywords found',
        });
      }

      results.push({
        id: doc.id,
        address,
        reason: 'No owner financing keywords found',
        action: dryRun ? 'skipped' : 'deactivated',
      });
    }
  }

  // Print results
  console.log('=' .repeat(80));
  console.log('📊 RESULTS\n');

  console.log(`🔴 Properties with NEGATIVE keywords: ${negativeCount}`);
  if (negativeCount > 0) {
    console.log('\n   Examples:');
    results
      .filter(r => r.matchedPattern)
      .slice(0, 10)
      .forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.address}`);
        console.log(`      Reason: ${r.reason}`);
        console.log(`      Matched: "${r.matchedPattern}"`);
      });
  }

  console.log(`\n🟡 Properties with NO owner financing keywords: ${noKeywordCount}`);
  if (noKeywordCount > 0) {
    console.log('\n   Examples:');
    results
      .filter(r => !r.matchedPattern)
      .slice(0, 10)
      .forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.address}`);
      });
  }

  console.log('\n' + '=' .repeat(80));
  console.log('📋 SUMMARY\n');
  console.log(`Total verified properties checked: ${snapshot.size}`);
  console.log(`Properties with issues: ${results.length}`);
  console.log(`  - Negative keywords: ${negativeCount}`);
  console.log(`  - Missing keywords: ${noKeywordCount}`);
  console.log(`Clean properties: ${snapshot.size - results.length}`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes made');
    console.log('   Run with --live to actually deactivate these properties');
  } else {
    console.log(`\n✅ Deactivated ${results.length} false positive properties`);
  }

  console.log('\n');
}

// Check for --live flag
const isLive = process.argv.includes('--live');

cleanupFalsePositives(!isLive)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
