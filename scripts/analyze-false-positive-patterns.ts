/**
 * Analyze which filter patterns are causing false positives
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

/**
 * All POSITIVE patterns from the filter (including broad ones)
 */
const ALL_POSITIVE_PATTERNS = [
  { pattern: /owner\s*financ/i, name: 'owner financ' },
  { pattern: /seller\s*financ/i, name: 'seller financ' },
  { pattern: /owner\s*carry/i, name: 'owner carry' },
  { pattern: /seller\s*carry/i, name: 'seller carry' },
  { pattern: /owner\s*will\s*finance/i, name: 'owner will finance' },
  { pattern: /seller\s*will\s*finance/i, name: 'seller will finance' },
  { pattern: /financing?\s*available/i, name: 'financing available' },
  { pattern: /financing?\s*offered/i, name: 'financing offered' },
  { pattern: /financing?\s*options/i, name: 'financing options' },
  { pattern: /creative\s*financ/i, name: 'creative financ' },
  { pattern: /flexible\s*financ/i, name: 'flexible financ' },
  { pattern: /terms\s*available/i, name: 'terms available' },
  { pattern: /owner\s*terms/i, name: 'owner terms' },
  { pattern: /seller\s*terms/i, name: 'seller terms' },
  { pattern: /flexible\s*terms/i, name: 'flexible terms' },
  { pattern: /buyer\s*incentive/i, name: 'buyer incentive' },
  { pattern: /closing\s*cost.*credit/i, name: 'closing cost credit' },
  { pattern: /rate\s*buy.*down/i, name: 'rate buydown' },
  { pattern: /preferred\s*lender/i, name: 'preferred lender' },
  { pattern: /investor\s*special/i, name: 'investor special' },
  { pattern: /cash\s*flow/i, name: 'cash flow' },
  { pattern: /rental\s*income/i, name: 'rental income' },
  { pattern: /investment\s*opportunity/i, name: 'investment opportunity' },
  { pattern: /great\s*opportunity/i, name: 'great opportunity' },
  { pattern: /perfect\s*opportunity/i, name: 'perfect opportunity' },
  { pattern: /flipper/i, name: 'flipper' },
  { pattern: /fixer.*upper/i, name: 'fixer upper' },
  { pattern: /rent.*to.*own/i, name: 'rent to own' },
  { pattern: /lease.*option/i, name: 'lease option' },
  { pattern: /lease.*purchase/i, name: 'lease purchase' },
  { pattern: /sold\s*as.*is/i, name: 'sold as is' },
  { pattern: /as.*is.*sale/i, name: 'as is sale' },
  { pattern: /motivated\s*seller/i, name: 'motivated seller' },
  { pattern: /bring.*offer/i, name: 'bring offer' },
  { pattern: /make.*offer/i, name: 'make offer' },
  { pattern: /all.*offers.*considered/i, name: 'all offers considered' },
  { pattern: /low.*down/i, name: 'low down' },
  { pattern: /down.*payment/i, name: 'down payment' },
  { pattern: /\$.*down/i, name: '$ down' },
  { pattern: /turn.*key/i, name: 'turn key' },
  { pattern: /handyman.*special/i, name: 'handyman special' },
  { pattern: /needs.*work/i, name: 'needs work' },
];

/**
 * STRICT owner financing patterns
 */
const STRICT_PATTERNS = [
  'owner financ',
  'seller financ',
  'owner carry',
  'seller carry',
  'owner will finance',
  'seller will finance',
  'owner terms',
  'seller terms',
  'creative financ',
  'flexible financ',
  'rent to own',
  'lease option',
  'lease purchase',
];

async function analyzeFalsePositives() {
  console.log('🔍 Analyzing False Positive Patterns\n');
  console.log('=' .repeat(80));

  // Get all properties sent to GHL
  const snapshot = await db
    .collection('zillow_imports')
    .where('sentToGHL', '==', true)
    .get();

  console.log(`\n📊 Total properties sent to GHL: ${snapshot.size}\n`);

  // Track pattern statistics
  const patternStats: Record<string, {
    totalMatches: number;
    truePositives: number;
    falsePositives: number;
    isStrict: boolean;
  }> = {};

  // Initialize stats
  ALL_POSITIVE_PATTERNS.forEach(({ name }) => {
    patternStats[name] = {
      totalMatches: 0,
      truePositives: 0,
      falsePositives: 0,
      isStrict: STRICT_PATTERNS.includes(name),
    };
  });

  let totalTruePositives = 0;
  let totalFalsePositives = 0;

  // Analyze each property
  snapshot.forEach((doc) => {
    const data = doc.data();
    const description = data.description || '';

    // Check if has STRICT owner financing mention
    const hasStrictOF = STRICT_PATTERNS.some(pattern => {
      return new RegExp(pattern, 'i').test(description);
    });

    if (hasStrictOF) {
      totalTruePositives++;
    } else {
      totalFalsePositives++;
    }

    // Find which patterns matched
    ALL_POSITIVE_PATTERNS.forEach(({ pattern, name }) => {
      if (pattern.test(description)) {
        patternStats[name].totalMatches++;

        if (hasStrictOF) {
          patternStats[name].truePositives++;
        } else {
          patternStats[name].falsePositives++;
        }
      }
    });
  });

  // Sort by false positive count
  const sortedPatterns = Object.entries(patternStats)
    .sort((a, b) => b[1].falsePositives - a[1].falsePositives);

  console.log('=' .repeat(80));
  console.log('📊 PATTERN ANALYSIS - Sorted by False Positives');
  console.log('=' .repeat(80));
  console.log(`Total True Positives: ${totalTruePositives} (${((totalTruePositives / snapshot.size) * 100).toFixed(1)}%)`);
  console.log(`Total False Positives: ${totalFalsePositives} (${((totalFalsePositives / snapshot.size) * 100).toFixed(1)}%)`);
  console.log('=' .repeat(80));
  console.log();

  console.log('Pattern Name'.padEnd(30) + 'Total'.padEnd(10) + 'True+'.padEnd(10) + 'False+'.padEnd(10) + 'FP Rate'.padEnd(10) + 'Type');
  console.log('-'.repeat(80));

  sortedPatterns.forEach(([name, stats]) => {
    if (stats.totalMatches === 0) return;

    const fpRate = ((stats.falsePositives / stats.totalMatches) * 100).toFixed(1);
    const type = stats.isStrict ? 'STRICT' : 'BROAD';
    const marker = stats.falsePositives > 50 ? '⚠️ ' : stats.falsePositives > 0 ? '  ' : '✅';

    console.log(
      marker +
      name.padEnd(28) +
      stats.totalMatches.toString().padEnd(10) +
      stats.truePositives.toString().padEnd(10) +
      stats.falsePositives.toString().padEnd(10) +
      `${fpRate}%`.padEnd(10) +
      type
    );
  });

  console.log('\n' + '=' .repeat(80));
  console.log('🎯 RECOMMENDATIONS');
  console.log('=' .repeat(80));

  // Find problematic patterns (>90% false positive rate)
  const problematicPatterns = sortedPatterns.filter(([_, stats]) => {
    return stats.totalMatches > 10 && (stats.falsePositives / stats.totalMatches) > 0.9;
  });

  if (problematicPatterns.length > 0) {
    console.log('\n❌ REMOVE THESE PATTERNS (>90% false positive rate):');
    problematicPatterns.forEach(([name, stats]) => {
      const fpRate = ((stats.falsePositives / stats.totalMatches) * 100).toFixed(1);
      console.log(`   - "${name}" (${stats.falsePositives}/${stats.totalMatches} = ${fpRate}% FP)`);
    });
  }

  // Find concerning patterns (50-90% FP rate)
  const concerningPatterns = sortedPatterns.filter(([_, stats]) => {
    const fpRate = stats.falsePositives / stats.totalMatches;
    return stats.totalMatches > 10 && fpRate > 0.5 && fpRate <= 0.9;
  });

  if (concerningPatterns.length > 0) {
    console.log('\n⚠️  REVIEW THESE PATTERNS (50-90% false positive rate):');
    concerningPatterns.forEach(([name, stats]) => {
      const fpRate = ((stats.falsePositives / stats.totalMatches) * 100).toFixed(1);
      console.log(`   - "${name}" (${stats.falsePositives}/${stats.totalMatches} = ${fpRate}% FP)`);
    });
  }

  // Find good patterns (<10% FP rate)
  const goodPatterns = sortedPatterns.filter(([_, stats]) => {
    return stats.totalMatches > 5 && (stats.falsePositives / stats.totalMatches) < 0.1;
  });

  if (goodPatterns.length > 0) {
    console.log('\n✅ KEEP THESE PATTERNS (<10% false positive rate):');
    goodPatterns.forEach(([name, stats]) => {
      const fpRate = ((stats.falsePositives / stats.totalMatches) * 100).toFixed(1);
      console.log(`   - "${name}" (${stats.falsePositives}/${stats.totalMatches} = ${fpRate}% FP)`);
    });
  }

  console.log('\n' + '=' .repeat(80));
  console.log('💡 SUMMARY');
  console.log('=' .repeat(80));
  console.log(`Current filter has ${((totalFalsePositives / snapshot.size) * 100).toFixed(1)}% false positive rate`);
  console.log(`If you remove all BROAD patterns and keep only STRICT patterns:`);
  console.log(`  - Expected true positives: ${totalTruePositives} (${((totalTruePositives / snapshot.size) * 100).toFixed(1)}%)`);
  console.log(`  - Expected false positives: 0 (0.0%)`);
  console.log(`  - Improvement: ${totalFalsePositives} fewer false positives`);
  console.log('=' .repeat(80));
}

analyzeFalsePositives().catch(console.error);
