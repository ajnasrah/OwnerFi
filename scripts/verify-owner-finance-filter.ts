/**
 * Verification script to check if properties sent to GHL actually mention owner financing
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Missing FIREBASE_PROJECT_ID environment variable');
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

/**
 * STRICT owner financing patterns - only actual owner/seller financing mentions
 */
const STRICT_OWNER_FINANCE_PATTERNS = [
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

/**
 * Check if description has STRICT owner financing mention
 */
function hasStrictOwnerFinancing(description: string | null | undefined): boolean {
  if (!description) return false;

  for (const pattern of STRICT_OWNER_FINANCE_PATTERNS) {
    if (pattern.test(description)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract the matching pattern from description
 */
function getMatchingPattern(description: string): string[] {
  const matches: string[] = [];

  for (const pattern of STRICT_OWNER_FINANCE_PATTERNS) {
    const match = description.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  return matches;
}

interface PropertyData {
  zpid: number;
  fullAddress: string;
  description: string;
  sentToGHL: boolean;
  ghlSentAt: any;
  price: number;
  estimate: number;
}

async function verifyOwnerFinanceFilter() {
  console.log('🔍 Verifying Owner Finance Filter Accuracy\n');
  console.log('=' .repeat(80));

  // Query properties that were sent to GHL
  const snapshot = await db
    .collection('zillow_imports')
    .where('sentToGHL', '==', true)
    .get();

  console.log(`\n📊 Total properties sent to GHL: ${snapshot.size}\n`);

  const properties: PropertyData[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data() as PropertyData;
    properties.push(data);
  });

  // Categorize properties
  const withStrictOwnerFinance: PropertyData[] = [];
  const withoutOwnerFinance: PropertyData[] = [];
  const noDescription: PropertyData[] = [];

  for (const property of properties) {
    if (!property.description || property.description.trim().length === 0) {
      noDescription.push(property);
    } else if (hasStrictOwnerFinancing(property.description)) {
      withStrictOwnerFinance.push(property);
    } else {
      withoutOwnerFinance.push(property);
    }
  }

  // Print results
  console.log('=' .repeat(80));
  console.log('📈 RESULTS SUMMARY');
  console.log('=' .repeat(80));
  console.log(`✅ Properties with STRICT owner financing mention: ${withStrictOwnerFinance.length}`);
  console.log(`❌ Properties WITHOUT owner financing mention: ${withoutOwnerFinance.length}`);
  console.log(`⚠️  Properties with no description: ${noDescription.length}`);
  console.log(`\n📉 False Positive Rate: ${((withoutOwnerFinance.length / snapshot.size) * 100).toFixed(1)}%`);
  console.log(`📈 True Positive Rate: ${((withStrictOwnerFinance.length / snapshot.size) * 100).toFixed(1)}%`);
  console.log('=' .repeat(80));

  // Show sample false positives
  if (withoutOwnerFinance.length > 0) {
    console.log(`\n❌ FALSE POSITIVES (sent to GHL but no owner financing mention):`);
    console.log('=' .repeat(80));

    const samplesToShow = Math.min(10, withoutOwnerFinance.length);
    for (let i = 0; i < samplesToShow; i++) {
      const prop = withoutOwnerFinance[i];
      console.log(`\n[${i + 1}/${samplesToShow}]`);
      console.log(`Address: ${prop.fullAddress}`);
      console.log(`Price: $${prop.price?.toLocaleString() || 'N/A'}`);
      console.log(`ZPID: ${prop.zpid}`);

      // Show first 300 chars of description
      const descPreview = prop.description?.substring(0, 300) || 'No description';
      console.log(`Description: ${descPreview}...`);
      console.log('-'.repeat(80));
    }

    if (withoutOwnerFinance.length > 10) {
      console.log(`\n... and ${withoutOwnerFinance.length - 10} more false positives\n`);
    }
  }

  // Show sample true positives
  if (withStrictOwnerFinance.length > 0) {
    console.log(`\n✅ TRUE POSITIVES (correctly identified owner financing):`);
    console.log('=' .repeat(80));

    const samplesToShow = Math.min(5, withStrictOwnerFinance.length);
    for (let i = 0; i < samplesToShow; i++) {
      const prop = withStrictOwnerFinance[i];
      const matches = getMatchingPattern(prop.description);

      console.log(`\n[${i + 1}/${samplesToShow}]`);
      console.log(`Address: ${prop.fullAddress}`);
      console.log(`Price: $${prop.price?.toLocaleString() || 'N/A'}`);
      console.log(`Matched Pattern(s): ${matches.join(', ')}`);
      console.log('-'.repeat(80));
    }
  }

  // Export detailed CSV
  console.log('\n📄 Exporting detailed results to CSV...');
  const csvRows = [
    'ZPID,Address,Price,Estimate,Has_Owner_Finance,Sent_Date,Description_Preview'
  ];

  for (const prop of properties) {
    const hasOF = hasStrictOwnerFinancing(prop.description);
    const descPreview = (prop.description || '').replace(/[\n\r,]/g, ' ').substring(0, 200);
    const sentDate = prop.ghlSentAt?.toDate?.()?.toISOString() || 'N/A';

    csvRows.push(
      `${prop.zpid},"${prop.fullAddress}",${prop.price || 0},${prop.estimate || 0},${hasOF},${sentDate},"${descPreview}"`
    );
  }

  const csv = csvRows.join('\n');
  const fs = require('fs');
  fs.writeFileSync('/tmp/owner-finance-verification.csv', csv);
  console.log('✅ Exported to /tmp/owner-finance-verification.csv');

  console.log('\n' + '=' .repeat(80));
  console.log('🎯 CONCLUSION');
  console.log('=' .repeat(80));

  if (withoutOwnerFinance.length > withStrictOwnerFinance.length) {
    console.log('⚠️  WARNING: More than half of sent properties DO NOT mention owner financing!');
    console.log('⚠️  The filter is likely too broad and includes generic investor keywords.');
  } else if (withoutOwnerFinance.length > 0) {
    console.log('⚠️  Some false positives detected. Consider tightening the filter.');
  } else {
    console.log('✅ All properties correctly mention owner financing!');
  }

  console.log('=' .repeat(80));
}

// Run the verification
verifyOwnerFinanceFilter().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
