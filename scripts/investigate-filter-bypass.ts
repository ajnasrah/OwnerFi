import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasNegativeKeywords } from '../src/lib/negative-keywords';
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

async function investigateFilterBypass() {
  console.log('\n🔍 INVESTIGATING WHY 5 PROPERTIES PASSED FILTER\n');
  console.log('='.repeat(80));

  // The 5 problematic properties
  const problematicIds = [
    'IEkJ0xU7XKDkAubepVRo', // Idaho Falls - "no owner-carry"
    'S9gVOzfGWDzrR2y6jfuz', // Memphis 1414 - "no wholesalers or seller financing"
    'jEXDiHo8D3dkup4bakss', // Memphis 1380 - "no wholesalers or seller financing"
    'oXtrHmD6b82YdDWVtBWX', // Memphis 3230 - "no seller-financing"
    'ounsULsNmvCvPNf1k5S4', // Cleveland - "no wholesalers or owner-financing"
  ];

  for (const docId of problematicIds) {
    const doc = await db.collection('zillow_imports').doc(docId).get();

    if (!doc.exists) {
      console.log(`\n❌ Document ${docId} not found`);
      continue;
    }

    const data = doc.data()!;
    const description = data.description;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n📍 PROPERTY: ${data.fullAddress}`);
    console.log(`   Doc ID: ${docId}`);
    console.log(`   ZPID: ${data.zpid}`);
    console.log(`   Added: ${data.foundAt?.toDate?.() || 'Unknown'}`);
    console.log(`   Source: ${data.source}`);

    console.log(`\n📝 FULL DESCRIPTION:`);
    console.log('-'.repeat(80));
    console.log(description);
    console.log('-'.repeat(80));

    // Test with current filter
    console.log(`\n🧪 FILTER TESTS:`);

    // Test negative keywords
    const negativeResult = hasNegativeKeywords(description);
    console.log(`\n1. Negative Keywords Check:`);
    console.log(`   Has negative: ${negativeResult.hasNegative}`);
    if (negativeResult.hasNegative) {
      console.log(`   Matched: ${negativeResult.matches.join(', ')}`);
    }

    // Test strict filter
    const strictResult = hasStrictOwnerFinancing(description);
    console.log(`\n2. Strict Filter Check:`);
    console.log(`   Passes: ${strictResult.passes}`);
    console.log(`   Matched keywords: ${strictResult.matchedKeywords.join(', ') || 'None'}`);
    console.log(`   Primary keyword: ${strictResult.primaryKeyword || 'None'}`);

    // Check what's stored in database
    console.log(`\n3. Database Fields:`);
    console.log(`   ownerFinanceVerified: ${data.ownerFinanceVerified}`);
    console.log(`   matchedKeywords: ${data.matchedKeywords?.join(', ') || 'None'}`);
    console.log(`   primaryKeyword: ${data.primaryKeyword || 'None'}`);

    // Look for positive keywords that might have triggered
    console.log(`\n4. Description Analysis:`);
    const lowerDesc = description.toLowerCase();

    const positivePatterns = [
      'owner financing',
      'seller financing',
      'owner carry',
      'seller carry',
      'creative financing',
      'flexible financing',
      'terms available',
      'rent to own',
      'lease option',
      'lease purchase',
    ];

    console.log(`   Positive keywords found:`);
    positivePatterns.forEach(pattern => {
      if (lowerDesc.includes(pattern)) {
        const index = lowerDesc.indexOf(pattern);
        const context = description.substring(Math.max(0, index - 50), Math.min(description.length, index + pattern.length + 100));
        console.log(`   ✓ "${pattern}" at position ${index}`);
        console.log(`     Context: ...${context}...`);
      }
    });

    const negativePatterns = [
      'no owner financing',
      'no seller financing',
      'no owner-financing',
      'no seller-financing',
      'no wholesalers or seller financing',
      'no wholesalers or owner financing',
      'no owner-carry',
      'no seller-carry',
    ];

    console.log(`\n   Negative keywords found:`);
    negativePatterns.forEach(pattern => {
      if (lowerDesc.includes(pattern)) {
        const index = lowerDesc.indexOf(pattern);
        const context = description.substring(Math.max(0, index - 50), Math.min(description.length, index + pattern.length + 100));
        console.log(`   ✗ "${pattern}" at position ${index}`);
        console.log(`     Context: ...${context}...`);
      }
    });

    console.log(`\n❓ WHY DID IT PASS?`);
    if (strictResult.passes && negativeResult.hasNegative) {
      console.log(`   🐛 BUG: Property has BOTH positive AND negative keywords!`);
      console.log(`   The filter found positive keywords BEFORE checking negatives.`);
      console.log(`   This is a LOGIC ERROR in the filter order.`);
    } else if (strictResult.passes && !negativeResult.hasNegative) {
      console.log(`   ⚠️  Positive keywords found, but negative check says no negatives.`);
      console.log(`   Possible regex/pattern matching issue with negative keywords.`);
    } else {
      console.log(`   ✅ Filter would now correctly reject this property.`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('\n📊 INVESTIGATION SUMMARY\n');
  console.log('The filter logic in src/lib/owner-financing-filter-strict.ts:');
  console.log('Lines 68-76 check negative keywords FIRST (correct)');
  console.log('Lines 78-94 check positive keywords SECOND (correct)');
  console.log('');
  console.log('If properties with negatives passed, possible reasons:');
  console.log('1. Filter was added/updated AFTER these properties were imported');
  console.log('2. Negative keyword patterns need improvement');
  console.log('3. Properties were imported via different code path (manual upload?)');
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ Investigation complete!\n');
}

// Run investigation
investigateFilterBypass()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
