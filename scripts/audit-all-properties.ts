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

async function auditAllProperties() {
  console.log('\n🔍 COMPREHENSIVE PROPERTY AUDIT\n');
  console.log('='.repeat(80));
  console.log('Checking all properties for:');
  console.log('  1. Missing descriptions');
  console.log('  2. Negative keywords (e.g., "no owner financing")');
  console.log('  3. Properties that should NOT have passed filter\n');

  // Get ALL properties
  const allProperties = await db.collection('zillow_imports').get();

  console.log(`\n📦 Total properties in database: ${allProperties.size}\n`);

  // Tracking variables
  const issues = {
    noDescription: [] as any[],
    emptyDescription: [] as any[],
    hasNegativeKeywords: [] as any[],
    shouldNotPass: [] as any[],
    noMatchedKeywords: [] as any[],
  };

  let passedCount = 0;

  // Check each property
  console.log('🔄 Scanning properties...\n');

  allProperties.docs.forEach((doc, idx) => {
    const data = doc.data();
    const desc = data.description;

    // Progress indicator every 100 properties
    if ((idx + 1) % 100 === 0) {
      console.log(`   Scanned ${idx + 1}/${allProperties.size} properties...`);
    }

    // Check 1: Missing or empty description
    if (!desc || desc === null || desc === undefined) {
      issues.noDescription.push({
        id: doc.id,
        address: data.fullAddress,
        zpid: data.zpid,
        reason: desc === null ? 'null' : 'undefined',
      });
    } else if (typeof desc === 'string' && desc.trim().length === 0) {
      issues.emptyDescription.push({
        id: doc.id,
        address: data.fullAddress,
        zpid: data.zpid,
        length: desc.length,
      });
    } else if (typeof desc === 'string' && desc.trim().length > 0) {
      // Valid description - now check content

      // Check 2: Has negative keywords?
      const negativeCheck = hasNegativeKeywords(desc);
      if (negativeCheck.hasNegative) {
        issues.hasNegativeKeywords.push({
          id: doc.id,
          address: data.fullAddress,
          zpid: data.zpid,
          negativeKeywords: negativeCheck.matches,
          description: desc.substring(0, 200),
        });
      }

      // Check 3: Would it pass strict filter?
      const filterCheck = hasStrictOwnerFinancing(desc);
      if (!filterCheck.passes) {
        issues.shouldNotPass.push({
          id: doc.id,
          address: data.fullAddress,
          zpid: data.zpid,
          reason: 'Does not pass strict filter',
          description: desc.substring(0, 200),
        });
      } else {
        passedCount++;
      }

      // Check 4: No matched keywords despite being verified
      if (data.ownerFinanceVerified && (!data.matchedKeywords || data.matchedKeywords.length === 0)) {
        issues.noMatchedKeywords.push({
          id: doc.id,
          address: data.fullAddress,
          zpid: data.zpid,
          ownerFinanceVerified: data.ownerFinanceVerified,
        });
      }
    }
  });

  console.log('\n✅ Scan complete!\n');

  // Report findings
  console.log('=' .repeat(80));
  console.log('📊 AUDIT RESULTS\n');

  console.log('✅ PROPERTIES THAT PASS FILTER: ' + passedCount);
  console.log('');

  // Issue 1: Missing descriptions
  console.log(`❌ MISSING DESCRIPTIONS: ${issues.noDescription.length}`);
  if (issues.noDescription.length > 0) {
    console.log('   Top 10:');
    issues.noDescription.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.address}`);
      console.log(`      ZPID: ${item.zpid}`);
      console.log(`      Reason: ${item.reason}`);
      console.log(`      Doc ID: ${item.id}`);
    });
  }
  console.log('');

  // Issue 2: Empty descriptions
  console.log(`❌ EMPTY DESCRIPTIONS: ${issues.emptyDescription.length}`);
  if (issues.emptyDescription.length > 0) {
    console.log('   Top 10:');
    issues.emptyDescription.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.address}`);
      console.log(`      ZPID: ${item.zpid}`);
      console.log(`      Length: ${item.length}`);
    });
  }
  console.log('');

  // Issue 3: Has negative keywords
  console.log(`⚠️  HAS NEGATIVE KEYWORDS (should be filtered): ${issues.hasNegativeKeywords.length}`);
  if (issues.hasNegativeKeywords.length > 0) {
    console.log('   Top 10:');
    issues.hasNegativeKeywords.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.address}`);
      console.log(`      ZPID: ${item.zpid}`);
      console.log(`      Negative keywords: ${item.negativeKeywords.join(', ')}`);
      console.log(`      Description: ${item.description}...`);
      console.log(`      Doc ID: ${item.id}`);
    });
  }
  console.log('');

  // Issue 4: Should not pass filter
  console.log(`⚠️  SHOULD NOT PASS FILTER: ${issues.shouldNotPass.length}`);
  if (issues.shouldNotPass.length > 0) {
    console.log('   Top 10:');
    issues.shouldNotPass.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.address}`);
      console.log(`      ZPID: ${item.zpid}`);
      console.log(`      Reason: ${item.reason}`);
      console.log(`      Description: ${item.description}...`);
    });
  }
  console.log('');

  // Issue 5: No matched keywords
  console.log(`⚠️  VERIFIED BUT NO MATCHED KEYWORDS: ${issues.noMatchedKeywords.length}`);
  if (issues.noMatchedKeywords.length > 0) {
    console.log('   Top 10:');
    issues.noMatchedKeywords.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.address}`);
      console.log(`      ZPID: ${item.zpid}`);
    });
  }
  console.log('');

  // Summary
  console.log('=' .repeat(80));
  console.log('📋 SUMMARY\n');
  const totalIssues =
    issues.noDescription.length +
    issues.emptyDescription.length +
    issues.hasNegativeKeywords.length +
    issues.shouldNotPass.length;

  console.log(`Total properties scanned: ${allProperties.size}`);
  console.log(`Properties that pass filter: ${passedCount} (${((passedCount / allProperties.size) * 100).toFixed(1)}%)`);
  console.log(`Properties with issues: ${totalIssues} (${((totalIssues / allProperties.size) * 100).toFixed(1)}%)`);
  console.log('');

  if (totalIssues === 0) {
    console.log('✅ NO ISSUES FOUND - All properties are clean!');
  } else {
    console.log('⚠️  ISSUES FOUND - Consider cleaning up bad data');
    console.log('');
    console.log('Breakdown:');
    console.log(`  - Missing descriptions: ${issues.noDescription.length}`);
    console.log(`  - Empty descriptions: ${issues.emptyDescription.length}`);
    console.log(`  - Has negative keywords: ${issues.hasNegativeKeywords.length}`);
    console.log(`  - Should not pass filter: ${issues.shouldNotPass.length}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Audit complete!\n');

  // Save detailed report to file
  if (totalIssues > 0) {
    const report = {
      timestamp: new Date().toISOString(),
      totalScanned: allProperties.size,
      totalPassed: passedCount,
      totalIssues,
      issues: {
        noDescription: issues.noDescription,
        emptyDescription: issues.emptyDescription,
        hasNegativeKeywords: issues.hasNegativeKeywords,
        shouldNotPass: issues.shouldNotPass,
        noMatchedKeywords: issues.noMatchedKeywords,
      }
    };

    const fs = require('fs');
    const reportPath = './property-audit-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: ${reportPath}\n`);
  }
}

// Run the audit
auditAllProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
