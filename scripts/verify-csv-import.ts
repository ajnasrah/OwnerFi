import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

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

async function verifyImport() {
  console.log('\n🔍 Verifying CSV Import Results\n');
  console.log('=' .repeat(70));

  // Get total count
  const snapshot = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  console.log(`\n📊 Total Properties: ${snapshot.size}`);

  // Count by source
  let csvImports = 0;
  let zillowScrapes = 0;
  let withFinancing = 0;
  let withImages = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.source === 'CSV Import') csvImports++;
    else zillowScrapes++;

    if (data.monthlyPayment) withFinancing++;
    if (data.firstPropertyImage || data.imageUrl) withImages++;
  });

  console.log(`\n📈 Breakdown:`);
  console.log(`   CSV Imports:          ${csvImports}`);
  console.log(`   Zillow Scrapes:       ${zillowScrapes}`);
  console.log(`   With Financing:       ${withFinancing}`);
  console.log(`   With Images:          ${withImages}`);

  // Sample some newly imported properties
  console.log('\n' + '='.repeat(70));
  console.log('\n📋 Sample of Recently Imported Properties:\n');

  const recentImports = await db.collection('zillow_imports')
    .where('source', '==', 'CSV Import')
    .orderBy('importedAt', 'desc')
    .limit(5)
    .get();

  recentImports.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ${data.fullAddress}`);
    console.log(`   Price: $${data.price?.toLocaleString() || 'N/A'}`);
    console.log(`   ${data.bedrooms || '?'} bed, ${data.bathrooms || '?'} bath`);
    console.log(`   Monthly: $${data.monthlyPayment || 'N/A'}`);
    console.log(`   Image: ${data.firstPropertyImage ? 'Yes' : 'No'}`);
    console.log('');
  });

  // Check for one of the addresses we know was missing
  console.log('='.repeat(70));
  console.log('\n🔎 Checking specific addresses that were missing:\n');

  const testAddresses = [
    '230 Park Avenue, Rocky Mount, NC 27801',
    '4498 Suncrest Dr, Memphis, TN 38127',
    '5284 flowering peach dr'
  ];

  for (const address of testAddresses) {
    const searchResults = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    let found = false;
    searchResults.forEach(doc => {
      const data = doc.data();
      if (data.fullAddress?.toLowerCase().includes(address.toLowerCase()) ||
          data.streetAddress?.toLowerCase().includes(address.toLowerCase())) {
        found = true;
        console.log(`✅ FOUND: ${address}`);
        console.log(`   Full Address: ${data.fullAddress}`);
        console.log(`   Source: ${data.source}`);
        console.log(`   Price: $${data.price?.toLocaleString() || 'N/A'}`);
        console.log('');
      }
    });

    if (!found) {
      console.log(`❌ NOT FOUND: ${address}\n`);
    }
  }

  console.log('='.repeat(70));
  console.log('\n✅ Verification complete!\n');
}

verifyImport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
