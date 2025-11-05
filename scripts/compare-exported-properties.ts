/**
 * Compare "exported to website" properties from GHL CSV with Firebase
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function compareProperties() {
  console.log('🔍 Comparing "exported to website" properties...\n');

  // Read CSV and filter for "exported to website" stage
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');

  // Find column indices
  const stageIdx = headers.findIndex(h => h.trim() === 'stage');
  const oppIdIdx = headers.findIndex(h => h.trim() === 'Opportunity ID');
  const addressIdx = headers.findIndex(h => h.trim() === 'Property Address');

  console.log(`Column indices - Stage: ${stageIdx}, Opp ID: ${oppIdIdx}, Address: ${addressIdx}\n`);

  const exportedProps = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cells = line.split(',');
    const stage = cells[stageIdx]?.trim().toLowerCase();

    if (stage === 'exported to website') {
      const oppId = cells[oppIdIdx]?.trim();
      const address = cells[addressIdx]?.trim();

      if (oppId && address) {
        exportedProps.push({ oppId, address });
      }
    }
  }

  console.log(`📊 Found ${exportedProps.length} properties in "exported to website" stage\n`);

  // Get all properties from Firebase
  console.log('📦 Fetching properties from Firebase...');
  const snapshot = await db.collection('properties').get();
  console.log(`   Found ${snapshot.size} properties in Firebase\n`);

  const firebaseProps = new Map();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.opportunityId) {
      firebaseProps.set(data.opportunityId, {
        id: doc.id,
        address: data.address,
        fullAddress: data.fullAddress
      });
    }
  });

  console.log('='.repeat(80));
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80) + '\n');

  const missingInFirebase = [];
  const addressMismatches = [];
  const matched = [];

  for (const { oppId, address } of exportedProps) {
    const fbProp = firebaseProps.get(oppId);

    if (!fbProp) {
      missingInFirebase.push({ oppId, address });
    } else {
      matched.push(oppId);

      // Check if addresses match
      if (fbProp.address && address.toLowerCase() !== fbProp.address.toLowerCase()) {
        addressMismatches.push({
          oppId,
          csvAddress: address,
          fbAddress: fbProp.address
        });
      }
    }
  }

  console.log(`✅ Matched: ${matched.length}/${exportedProps.length}`);
  console.log(`❌ Missing in Firebase: ${missingInFirebase.length}`);
  console.log(`⚠️  Address Mismatches: ${addressMismatches.length}\n`);

  if (missingInFirebase.length > 0) {
    console.log('\n❌ MISSING IN FIREBASE:');
    console.log('   (These properties are marked "exported to website" in GHL but NOT in Firebase)\n');
    missingInFirebase.forEach(({ oppId, address }, idx) => {
      console.log(`   ${idx + 1}. ${address}`);
      console.log(`      Opportunity ID: ${oppId}\n`);
    });
  }

  if (addressMismatches.length > 0) {
    console.log('\n⚠️  ADDRESS MISMATCHES:');
    console.log('   (Same Opportunity ID but different addresses)\n');
    addressMismatches.forEach(({ oppId, csvAddress, fbAddress }, idx) => {
      console.log(`   ${idx + 1}. Opportunity ID: ${oppId}`);
      console.log(`      CSV:      ${csvAddress}`);
      console.log(`      Firebase: ${fbAddress}\n`);
    });
  }

  if (missingInFirebase.length === 0 && addressMismatches.length === 0) {
    console.log('\n🎉 PERFECT! All "exported to website" properties match Firebase!');
  }

  console.log('\n' + '='.repeat(80));

  // Save report
  const report = {
    totalExported: exportedProps.length,
    totalInFirebase: firebaseProps.size,
    matched: matched.length,
    missingInFirebase: missingInFirebase.length,
    addressMismatches: addressMismatches.length,
    missingList: missingInFirebase,
    mismatchList: addressMismatches
  };

  fs.writeFileSync(
    '/Users/abdullahabunasrah/Desktop/ownerfi/exported-properties-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 Detailed report saved to: exported-properties-report.json');
}

compareProperties().catch(console.error);
