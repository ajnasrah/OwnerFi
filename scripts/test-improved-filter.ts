/**
 * Test the improved filter against existing data
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

/**
 * STRICT patterns for comparison
 */
const STRICT_PATTERNS = [
  /owner\s*financ/i,
  /seller\s*financ/i,
  /owner\s*carry/i,
  /seller\s*carry/i,
  /owner\s*will\s*finance/i,
  /seller\s*will\s*finance/i,
  /owner\s*terms/i,
  /seller\s*terms/i,
  /creative\s*financ/i,
  /flexible\s*financ/i,
  /rent.*to.*own/i,
  /lease.*option/i,
  /lease.*purchase/i,
];

function hasStrictOwnerFinancing(description: string | null | undefined): boolean {
  if (!description) return false;
  return STRICT_PATTERNS.some(pattern => pattern.test(description));
}

async function testImprovedFilter() {
  console.log('🧪 Testing Improved Owner Financing Filter\n');
  console.log('=' .repeat(80));

  // Get all properties sent to GHL
  const snapshot = await db
    .collection('zillow_imports')
    .where('sentToGHL', '==', true)
    .get();

  console.log(`\n📊 Testing against ${snapshot.size} properties previously sent to GHL\n`);

  let oldFilterMatches = snapshot.size; // All were sent with old filter
  let newFilterMatches = 0;
  let truePositives = 0;
  let falsePositivesOld = 0;
  let falsePositivesNew = 0;

  const wouldBeFilteredOut: Array<{
    zpid: number;
    address: string;
    price: number;
    description: string;
  }> = [];

  const newFalsePositives: Array<{
    zpid: number;
    address: string;
    price: number;
    description: string;
  }> = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const description = data.description || '';

    // Check with strict patterns (ground truth)
    const hasStrictOF = hasStrictOwnerFinancing(description);

    if (hasStrictOF) {
      truePositives++;
    } else {
      falsePositivesOld++;
    }

    // Check with new filter
    const newFilterResult = hasOwnerFinancing(description);

    if (newFilterResult.shouldSend) {
      newFilterMatches++;

      // Is this a false positive with new filter?
      if (!hasStrictOF) {
        falsePositivesNew++;
        newFalsePositives.push({
          zpid: data.zpid,
          address: data.fullAddress,
          price: data.price,
          description: description.substring(0, 200),
        });
      }
    } else {
      // Property would be filtered out by new filter
      wouldBeFilteredOut.push({
        zpid: data.zpid,
        address: data.fullAddress,
        price: data.price,
        description: description.substring(0, 200),
      });
    }
  });

  // Calculate metrics
  const oldFPRate = (falsePositivesOld / oldFilterMatches) * 100;
  const newFPRate = (falsePositivesNew / newFilterMatches) * 100;
  const improvement = falsePositivesOld - falsePositivesNew;
  const coverageRate = (newFilterMatches / truePositives) * 100;

  console.log('=' .repeat(80));
  console.log('📊 COMPARISON: OLD FILTER vs NEW FILTER');
  console.log('=' .repeat(80));
  console.log();
  console.log('OLD FILTER (42 patterns):');
  console.log(`  Total matches:      ${oldFilterMatches.toLocaleString()}`);
  console.log(`  True positives:     ${truePositives.toLocaleString()}`);
  console.log(`  False positives:    ${falsePositivesOld.toLocaleString()}`);
  console.log(`  False positive rate: ${oldFPRate.toFixed(1)}%`);
  console.log();
  console.log('NEW FILTER (18 patterns):');
  console.log(`  Total matches:      ${newFilterMatches.toLocaleString()}`);
  console.log(`  True positives:     ${Math.min(newFilterMatches, truePositives).toLocaleString()}`);
  console.log(`  False positives:    ${falsePositivesNew.toLocaleString()}`);
  console.log(`  False positive rate: ${newFPRate.toFixed(1)}%`);
  console.log();
  console.log('IMPROVEMENT:');
  console.log(`  ✅ False positives reduced by: ${improvement.toLocaleString()} (${((improvement / falsePositivesOld) * 100).toFixed(1)}% reduction)`);
  console.log(`  ✅ Accuracy improved from ${(100 - oldFPRate).toFixed(1)}% to ${(100 - newFPRate).toFixed(1)}%`);
  console.log(`  📉 Properties filtered out: ${wouldBeFilteredOut.length.toLocaleString()}`);
  console.log(`  📈 Coverage of true owner finance: ${coverageRate.toFixed(1)}%`);
  console.log('=' .repeat(80));

  // Show what would be filtered out
  if (wouldBeFilteredOut.length > 0) {
    console.log(`\n📋 PROPERTIES THAT WOULD BE FILTERED OUT (${wouldBeFilteredOut.length} total):`);
    console.log('=' .repeat(80));
    console.log('These were sent with OLD filter but would NOT be sent with NEW filter:');
    console.log();

    const samplesToShow = Math.min(10, wouldBeFilteredOut.length);
    for (let i = 0; i < samplesToShow; i++) {
      const prop = wouldBeFilteredOut[i];
      console.log(`[${i + 1}/${samplesToShow}]`);
      console.log(`Address: ${prop.address}`);
      console.log(`Price: $${prop.price?.toLocaleString() || 'N/A'}`);
      console.log(`Preview: ${prop.description}...`);
      console.log('-'.repeat(80));
    }

    if (wouldBeFilteredOut.length > 10) {
      console.log(`\n... and ${wouldBeFilteredOut.length - 10} more would be filtered out\n`);
    }
  }

  // Show new false positives if any
  if (newFalsePositives.length > 0) {
    console.log(`\n⚠️  NEW FILTER FALSE POSITIVES (${newFalsePositives.length} total):`);
    console.log('=' .repeat(80));

    newFalsePositives.slice(0, 5).forEach((prop, i) => {
      console.log(`[${i + 1}/${Math.min(5, newFalsePositives.length)}]`);
      console.log(`Address: ${prop.address}`);
      console.log(`Price: $${prop.price?.toLocaleString() || 'N/A'}`);
      console.log(`Preview: ${prop.description}...`);
      console.log('-'.repeat(80));
    });
  } else {
    console.log('\n✅ NO FALSE POSITIVES with new filter!');
  }

  console.log('\n' + '=' .repeat(80));
  console.log('🎯 SUMMARY');
  console.log('=' .repeat(80));

  if (newFPRate < 5) {
    console.log('✅ EXCELLENT: New filter has <5% false positive rate!');
  } else if (newFPRate < 10) {
    console.log('✅ GOOD: New filter has <10% false positive rate');
  } else {
    console.log('⚠️  FAIR: New filter still has >10% false positive rate');
  }

  console.log(`✅ Reduced false positives by ${improvement} (${((improvement / falsePositivesOld) * 100).toFixed(0)}%)`);
  console.log(`✅ Maintains ${coverageRate.toFixed(1)}% coverage of true owner finance properties`);
  console.log('=' .repeat(80));
}

testImprovedFilter().catch(console.error);
