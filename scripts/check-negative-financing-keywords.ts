import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

/**
 * Negative keywords that indicate NO owner financing
 */
const NEGATIVE_KEYWORDS = [
  'no owner financing',
  'no seller financing',
  'no creative financing',
  'no owner carry',
  'no seller carry',
  'cash only',
  'cash or conventional',
  'conventional financing only',
  'no financing available',
  'financing not available',
  'owner financing not available',
  'seller financing not available',
];

/**
 * Check if description contains negative keywords
 */
function hasNegativeKeywords(description: string): { hasNegative: boolean; matches: string[] } {
  if (!description) return { hasNegative: false, matches: [] };

  const lowerDesc = description.toLowerCase();
  const matches: string[] = [];

  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      matches.push(keyword);
    }
  }

  return {
    hasNegative: matches.length > 0,
    matches,
  };
}

async function checkNegativeFinancingKeywords() {
  console.log('\n🔍 Checking for Properties with NEGATIVE Owner Financing Keywords\n');
  console.log('='.repeat(80));

  try {
    // Get all properties
    console.log('\n📥 Fetching all properties from zillow_imports...');
    const snapshot = await db.collection('zillow_imports').get();

    console.log(`📊 Found ${snapshot.size} total properties\n`);
    console.log('🔎 Scanning descriptions for negative keywords...\n');

    const falsePositives: Array<{
      id: string;
      address: string;
      description: string;
      negativeKeywords: string[];
      price: number;
      source: string;
    }> = [];

    let processedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      processedCount++;

      const description = data.description || '';
      const { hasNegative, matches } = hasNegativeKeywords(description);

      if (hasNegative) {
        falsePositives.push({
          id: doc.id,
          address: data.fullAddress || data.streetAddress || 'Unknown',
          description: description.substring(0, 500),
          negativeKeywords: matches,
          price: data.price || 0,
          source: data.source || 'Unknown',
        });
      }

      // Progress indicator
      if (processedCount % 100 === 0) {
        console.log(`⏳ Progress: ${processedCount}/${snapshot.size} properties scanned...`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SCAN RESULTS:\n');
    console.log(`Total Properties:                ${snapshot.size}`);
    console.log(`FALSE POSITIVES Found:           ${falsePositives.length}`);
    console.log(`Clean Properties:                ${snapshot.size - falsePositives.length}`);
    console.log(`False Positive Rate:             ${((falsePositives.length / snapshot.size) * 100).toFixed(1)}%`);

    if (falsePositives.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('\n⚠️  FALSE POSITIVE PROPERTIES (First 20):\n');

      falsePositives.slice(0, 20).forEach((prop, i) => {
        console.log(`\n${i + 1}. ${prop.address}`);
        console.log(`   ID: ${prop.id}`);
        console.log(`   Price: $${prop.price.toLocaleString()}`);
        console.log(`   Source: ${prop.source}`);
        console.log(`   Negative Keywords: ${prop.negativeKeywords.join(', ')}`);
        console.log(`   Description Excerpt: "${prop.description.substring(0, 200)}..."`);
      });

      if (falsePositives.length > 20) {
        console.log(`\n... and ${falsePositives.length - 20} more false positives`);
      }

      // Breakdown by negative keyword
      console.log('\n' + '='.repeat(80));
      console.log('\n📈 BREAKDOWN BY NEGATIVE KEYWORD:\n');

      const keywordCounts = new Map<string, number>();
      falsePositives.forEach(prop => {
        prop.negativeKeywords.forEach(keyword => {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        });
      });

      Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([keyword, count]) => {
          console.log(`   "${keyword}": ${count} properties`);
        });

      // Breakdown by source
      console.log('\n📈 BREAKDOWN BY SOURCE:\n');

      const sourceCounts = new Map<string, number>();
      falsePositives.forEach(prop => {
        sourceCounts.set(prop.source, (sourceCounts.get(prop.source) || 0) + 1);
      });

      Array.from(sourceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
          console.log(`   ${source}: ${count} properties`);
        });

      // Save to JSON for review
      const outputPath = path.join(process.cwd(), 'false-positive-properties.json');
      const fs = require('fs');
      fs.writeFileSync(outputPath, JSON.stringify(falsePositives, null, 2));
      console.log(`\n💾 Full list saved to: ${outputPath}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 RECOMMENDATIONS:\n');

    if (falsePositives.length > 0) {
      console.log(`1. Review the false-positive-properties.json file`);
      console.log(`2. Run the cleanup script to remove these properties`);
      console.log(`3. Update the filter to exclude negative keywords in future scrapes`);
      console.log(`\nTo remove false positives, run:`);
      console.log(`   npx tsx scripts/remove-false-positives.ts`);
    } else {
      console.log(`✅ No false positives found! All properties appear legitimate.`);
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkNegativeFinancingKeywords()
  .then(() => {
    console.log('\n✅ Scan complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Scan failed:', error);
    process.exit(1);
  });
