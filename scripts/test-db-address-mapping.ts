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

// Replicate the API's mapPropertyFields function
function mapPropertyFields(doc: any) {
  const data = doc.data();
  return {
    id: doc.id,
    fullAddress: data.fullAddress,
    streetAddress: data.streetAddress,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    // The key line - this is what the API does
    address: data.streetAddress || data.fullAddress || data.address,
  };
}

async function testDatabaseMapping() {
  console.log('\n🧪 Testing Database → API Address Mapping\n');
  console.log('='.repeat(80));
  console.log('\nThis simulates what the admin API does when mapping properties.\n');

  try {
    // Fetch 10 properties from database
    console.log('📥 Fetching 10 sample properties from zillow_imports...\n');
    const snapshot = await db.collection('zillow_imports').limit(10).get();

    console.log(`✅ Retrieved ${snapshot.size} properties\n`);
    console.log('🔍 Testing address field mapping (simulating API):\n');

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    snapshot.forEach((doc, index) => {
      const rawData = doc.data();
      const mapped = mapPropertyFields(doc);

      console.log(`━━━ Property ${index + 1} ━━━`);
      console.log(`ID: ${doc.id}`);
      console.log('\nRAW DATABASE FIELDS:');
      console.log(`  streetAddress: "${rawData.streetAddress || 'N/A'}"`);
      console.log(`  fullAddress:   "${rawData.fullAddress || 'N/A'}"`);
      console.log(`  city:          "${rawData.city || 'N/A'}"`);
      console.log(`  state:         "${rawData.state || 'N/A'}"`);
      console.log(`  zipCode:       "${rawData.zipCode || 'N/A'}"`);

      console.log('\nAPI MAPPED FIELDS:');
      console.log(`  address:       "${mapped.address}"`);
      console.log(`  city:          "${mapped.city}"`);
      console.log(`  state:         "${mapped.state}"`);
      console.log(`  zipCode:       "${mapped.zipCode}"`);

      // Test if the mapped address field is street-only
      const hasCity = mapped.city && mapped.address?.toLowerCase().includes(mapped.city.toLowerCase());
      const hasComma = mapped.address?.includes(',');
      const hasState = mapped.state && mapped.address?.includes(mapped.state);

      console.log('\nVALIDATION:');
      if (hasCity) {
        console.log(`  ❌ FAIL: address contains city name`);
        failCount++;
      } else if (hasComma) {
        console.log(`  ❌ FAIL: address contains comma (likely full address)`);
        failCount++;
      } else if (hasState) {
        console.log(`  ❌ FAIL: address contains state abbreviation`);
        failCount++;
      } else if (mapped.address && !hasComma && !hasCity) {
        console.log(`  ✅ PASS: address is street-only (no city/state/zip)`);
        passCount++;
      } else {
        console.log(`  ⚠️  WARN: address field unclear or empty`);
        warnCount++;
      }
      console.log();
    });

    // Summary
    console.log('='.repeat(80));
    console.log('\n📈 TEST SUMMARY:\n');
    console.log(`Total Properties:           ${snapshot.size}`);
    console.log(`✅ Street Only (PASS):      ${passCount} (${((passCount / snapshot.size) * 100).toFixed(1)}%)`);
    console.log(`❌ Contains City/Zip (FAIL): ${failCount} (${((failCount / snapshot.size) * 100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings:                ${warnCount}`);
    console.log('\n='.repeat(80));

    if (failCount === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('\nThe API mapping is working correctly:');
      console.log('  • address field = streetAddress (street only)');
      console.log('  • No duplication with city/state/zip in Location column');
    } else {
      console.log(`\n⚠️  ${failCount} properties failed validation.`);
      console.log('\nThis means some properties in the database still have:');
      console.log('  • fullAddress in streetAddress field, OR');
      console.log('  • streetAddress field is missing/empty');
      console.log('\nSolution: Run fix-all-property-addresses.ts again to clean them up.');
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDatabaseMapping()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
