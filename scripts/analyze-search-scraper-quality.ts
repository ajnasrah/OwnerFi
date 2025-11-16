import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

// Strict filter patterns (0% FP rate)
const STRICT_PATTERNS = [
  { pattern: /owner\s*financ/i, name: 'owner financing' },
  { pattern: /seller\s*financ/i, name: 'seller financing' },
  { pattern: /owner\s*carry/i, name: 'owner carry' },
  { pattern: /owner\s*will\s*carry/i, name: 'owner will carry' },
  { pattern: /seller\s*carry/i, name: 'seller carry' },
  { pattern: /seller\s*will\s*carry/i, name: 'seller will carry' },
  { pattern: /owner\s*will\s*finance/i, name: 'owner will finance' },
  { pattern: /seller\s*will\s*finance/i, name: 'seller will finance' },
  { pattern: /owner\s*terms/i, name: 'owner terms' },
  { pattern: /seller\s*terms/i, name: 'seller terms' },
  { pattern: /creative\s*financ/i, name: 'creative financing' },
  { pattern: /flexible\s*financ/i, name: 'flexible financing' },
  { pattern: /flexible\s*terms/i, name: 'flexible terms' },
  { pattern: /terms\s*available/i, name: 'terms available' },
  { pattern: /rent.*to.*own/i, name: 'rent to own' },
  { pattern: /lease.*option/i, name: 'lease option' },
  { pattern: /lease.*purchase/i, name: 'lease purchase' },
];

function hasStrictOwnerFinancing(description: string | null | undefined): { passes: boolean; matchedKeywords: string[] } {
  if (!description || description.trim().length === 0) {
    return { passes: false, matchedKeywords: [] };
  }

  const matchedKeywords: string[] = [];

  for (const { pattern, name } of STRICT_PATTERNS) {
    if (pattern.test(description)) {
      matchedKeywords.push(name);
    }
  }

  return {
    passes: matchedKeywords.length > 0,
    matchedKeywords,
  };
}

async function main() {
  console.log('🔍 Analyzing Search Scraper Quality\n');
  console.log('Checking how many properties from apify_search_scraper pass strict filter...\n');

  // Get all properties from search scraper
  const searchScraperProps = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify_search_scraper')
    .get();

  console.log(`📊 Total properties from search scraper: ${searchScraperProps.size}\n`);

  if (searchScraperProps.empty) {
    console.log('⚠️  No properties found from apify_search_scraper');
    console.log('   This might mean:');
    console.log('   1. Search scraper hasn\'t been run yet');
    console.log('   2. Properties have a different source value');
    console.log('\nLet me check what sources exist...\n');

    const allProps = await db.collection('zillow_imports').limit(10).get();
    const sources = new Set<string>();
    allProps.docs.forEach(doc => {
      const source = doc.data().source;
      if (source) sources.add(source);
    });

    console.log('Found sources:', Array.from(sources));
    return;
  }

  let passed = 0;
  let failed = 0;
  let noDescription = 0;

  const failedExamples: Array<{ address: string; description: string }> = [];

  for (const doc of searchScraperProps.docs) {
    const data = doc.data();
    const description = data.description;

    if (!description || description.trim().length === 0) {
      noDescription++;
      failed++;
      continue;
    }

    const result = hasStrictOwnerFinancing(description);

    if (result.passes) {
      passed++;
    } else {
      failed++;
      if (failedExamples.length < 10) {
        failedExamples.push({
          address: data.fullAddress || data.address || 'Unknown',
          description: description.substring(0, 200),
        });
      }
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📊 RESULTS:\n');
  console.log(`✅ PASS strict filter:  ${passed} (${((passed / searchScraperProps.size) * 100).toFixed(1)}%)`);
  console.log(`❌ FAIL strict filter:  ${failed} (${((failed / searchScraperProps.size) * 100).toFixed(1)}%)`);
  console.log(`   - No description:    ${noDescription}`);
  console.log(`   - Has description:   ${failed - noDescription}\n`);

  const falsePositiveRate = ((failed / searchScraperProps.size) * 100).toFixed(1);
  console.log(`🎯 False Positive Rate: ${falsePositiveRate}%`);
  console.log(`   (Properties from Zillow search that DON'T mention owner financing)\n`);

  if (failedExamples.length > 0) {
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📋 Sample Failed Properties (first ${failedExamples.length}):\n`);

    failedExamples.forEach((example, i) => {
      console.log(`${i + 1}. ${example.address}`);
      console.log(`   Description: ${example.description}...`);
      console.log('');
    });
  }

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('💡 RECOMMENDATION:\n');

  if (failed > 0) {
    console.log(`   Apply strict filter to search scraper to eliminate ${failed} false positives`);
    console.log(`   This would improve quality from ${((passed / searchScraperProps.size) * 100).toFixed(1)}% to 100%\n`);
  } else {
    console.log('   ✅ All properties from search scraper pass strict filter!');
    console.log('   Zillow\'s search is working perfectly.\n');
  }
}

main().catch(console.error);
