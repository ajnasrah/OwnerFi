/**
 * Audit all properties marked as Owner Finance
 * Verify each one actually contains owner financing keywords
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

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

interface AuditResult {
  zpid: string;
  address: string;
  passesFilter: boolean;
  matchedKeywords: string[];
  description: string;
  price?: number;
  createdAt?: Date;
}

async function auditOwnerFinanceProperties() {
  console.log('='.repeat(70));
  console.log('OWNER FINANCE PROPERTY AUDIT');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  // Get all properties marked as owner finance
  console.log('Fetching all isOwnerFinance=true properties...');

  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .get();

  console.log(`Found ${snapshot.size} owner finance properties to audit\n`);

  const results: AuditResult[] = [];
  const failures: AuditResult[] = [];
  const noDescription: AuditResult[] = [];
  let processed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const description = data.description || '';
    const address = data.fullAddress || data.streetAddress || doc.id;

    // Run the strict filter
    const filterResult = hasStrictOwnerFinancing(description);

    const result: AuditResult = {
      zpid: doc.id,
      address,
      passesFilter: filterResult.passes,
      matchedKeywords: filterResult.matchedKeywords,
      description: description.substring(0, 500),
      price: data.price,
      createdAt: data.createdAt?.toDate?.(),
    };

    results.push(result);

    if (!description || description.trim().length === 0) {
      noDescription.push(result);
    } else if (!filterResult.passes) {
      failures.push(result);
    }

    processed++;
    if (processed % 500 === 0) {
      console.log(`Processed ${processed}/${snapshot.size}...`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Owner Finance Properties: ${snapshot.size}`);
  console.log(`Passed Filter (VALID): ${results.filter(r => r.passesFilter).length}`);
  console.log(`Failed Filter (FALSE POSITIVES): ${failures.length}`);
  console.log(`No Description: ${noDescription.length}`);

  const passRate = ((results.filter(r => r.passesFilter).length / snapshot.size) * 100).toFixed(2);
  console.log(`\nPass Rate: ${passRate}%`);

  // Show failures in detail
  if (failures.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('FALSE POSITIVES (Properties that should NOT be marked as Owner Finance)');
    console.log('='.repeat(70));

    failures.forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.address}`);
      console.log(`   ZPID: ${f.zpid}`);
      console.log(`   Price: $${f.price?.toLocaleString() || 'N/A'}`);
      console.log(`   Created: ${f.createdAt?.toISOString() || 'N/A'}`);
      console.log(`   Description preview:`);
      console.log(`   "${f.description.substring(0, 300)}..."`);
      console.log('');
    });
  }

  // Show properties with no description
  if (noDescription.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('PROPERTIES WITH NO DESCRIPTION');
    console.log('='.repeat(70));

    noDescription.slice(0, 20).forEach((f, i) => {
      console.log(`${i + 1}. ${f.address} (${f.zpid})`);
    });

    if (noDescription.length > 20) {
      console.log(`... and ${noDescription.length - 20} more`);
    }
  }

  // Keyword distribution for valid properties
  console.log('\n' + '='.repeat(70));
  console.log('KEYWORD DISTRIBUTION (Valid Properties)');
  console.log('='.repeat(70));

  const keywordCounts: Record<string, number> = {};
  results.filter(r => r.passesFilter).forEach(r => {
    r.matchedKeywords.forEach(kw => {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });
  });

  Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([keyword, count]) => {
      const pct = ((count / results.filter(r => r.passesFilter).length) * 100).toFixed(1);
      console.log(`  ${keyword}: ${count} (${pct}%)`);
    });

  console.log('\n' + '='.repeat(70));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(70));

  return {
    total: snapshot.size,
    valid: results.filter(r => r.passesFilter).length,
    failures: failures.length,
    noDescription: noDescription.length,
    failureDetails: failures,
  };
}

auditOwnerFinanceProperties()
  .then((result) => {
    if (result.failures > 0) {
      console.log(`\n⚠️  Found ${result.failures} false positives that need review`);
    } else {
      console.log(`\n✅ All ${result.valid} owner finance properties are valid!`);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
