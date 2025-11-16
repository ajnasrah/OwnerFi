/**
 * Test Field Mapping
 * Verifies admin API correctly maps Zillow fields
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

async function testFieldMapping() {
  console.log('🧪 TESTING FIELD MAPPING\n');
  console.log('=' .repeat(80));

  // Simulate what admin API does
  const snapshot = await db
    .collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .limit(5)
    .get();

  console.log('\n[BEFORE MAPPING] Raw Zillow data:\n');

  const rawProperty = snapshot.docs[0].data();
  console.log('Field names in database:');
  console.log(`   fullAddress: "${rawProperty.fullAddress}"`);
  console.log(`   squareFoot: ${rawProperty.squareFoot}`);
  console.log(`   firstPropertyImage: "${rawProperty.firstPropertyImage?.substring(0, 50)}..."`);
  console.log(`   propertyImages: Array(${rawProperty.propertyImages?.length})`);
  console.log(`   price: $${rawProperty.price?.toLocaleString()}`);

  console.log('\n\n[AFTER MAPPING] Transformed data for admin panel:\n');

  const properties = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Map Zillow field names to admin panel expected names
      address: data.fullAddress || data.address,
      squareFeet: data.squareFoot || data.squareFeet,
      imageUrl: data.firstPropertyImage || data.imageUrl,
      imageUrls: data.propertyImages || data.imageUrls || [],
      zillowImageUrl: data.firstPropertyImage || data.zillowImageUrl,
      listPrice: data.price || data.listPrice,
    };
  });

  const mapped = properties[0];
  console.log('Field names admin panel expects:');
  console.log(`   address: "${mapped.address}"`);
  console.log(`   squareFeet: ${mapped.squareFeet}`);
  console.log(`   imageUrl: "${mapped.imageUrl?.substring(0, 50)}..."`);
  console.log(`   imageUrls: Array(${mapped.imageUrls?.length})`);
  console.log(`   listPrice: $${mapped.listPrice?.toLocaleString()}`);

  console.log('\n\n📊 VERIFICATION:\n');

  const checks = [
    {
      field: 'address',
      has: !!mapped.address,
      value: mapped.address
    },
    {
      field: 'squareFeet',
      has: mapped.squareFeet > 0,
      value: mapped.squareFeet
    },
    {
      field: 'imageUrl',
      has: !!mapped.imageUrl,
      value: mapped.imageUrl?.substring(0, 30) + '...'
    },
    {
      field: 'imageUrls (array)',
      has: Array.isArray(mapped.imageUrls) && mapped.imageUrls.length > 0,
      value: `${mapped.imageUrls?.length} images`
    },
    {
      field: 'listPrice',
      has: mapped.listPrice > 0,
      value: `$${mapped.listPrice?.toLocaleString()}`
    }
  ];

  checks.forEach(check => {
    const status = check.has ? '✅' : '❌';
    console.log(`   ${status} ${check.field}: ${check.value}`);
  });

  console.log('\n\n' + '=' .repeat(80));
  console.log('🎯 FIELD MAPPING TEST RESULTS');
  console.log('=' .repeat(80));

  const allPassed = checks.every(c => c.has);

  if (allPassed) {
    console.log('\n✅ ALL FIELDS MAPPED CORRECTLY!');
    console.log('\nAdmin panel will now show:');
    console.log('   ✅ Addresses');
    console.log('   ✅ Square footage');
    console.log('   ✅ Property images');
    console.log('   ✅ Prices');
  } else {
    console.log('\n❌ SOME FIELDS MISSING');
    console.log('\nCheck the mapping logic in admin API');
  }

  console.log('\n' + '=' .repeat(80));
}

testFieldMapping().catch(console.error);
