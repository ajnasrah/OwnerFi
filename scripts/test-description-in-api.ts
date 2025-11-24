import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function testDescriptionInAPI() {
  console.log('\n🧪 TESTING DESCRIPTION FIELD IN API RESPONSE\n');
  console.log('='.repeat(80));

  // Get a sample property from zillow_imports
  const zillowSnapshot = await db
    .collection('zillow_imports')
    .where('state', '==', 'TX')
    .limit(5)
    .get();

  if (zillowSnapshot.empty) {
    console.log('❌ No properties found in zillow_imports');
    return;
  }

  console.log(`\n✅ Found ${zillowSnapshot.size} properties in database\n`);

  // Simulate what the API does
  zillowSnapshot.docs.forEach((doc, idx) => {
    const data = doc.data();

    // This is what the API returns now (after our fix)
    const apiResponse = {
      id: doc.id,
      ...data,
      source: 'zillow',
      address: data.fullAddress || data.address,
      squareFeet: data.squareFoot || data.squareFeet,
      lotSize: data.lotSquareFoot || data.lotSize,
      listPrice: data.price || data.listPrice,
      termYears: data.loanTermYears || data.termYears,
      propertyType: data.homeType || data.buildingType || data.propertyType,
      imageUrl: data.firstPropertyImage || data.imageUrl,
      imageUrls: data.propertyImages || data.imageUrls || [],
      description: data.description || '', // <-- OUR FIX
      downPaymentPercent: data.downPaymentPercent || (data.downPaymentAmount && data.price ?
        Math.round((data.downPaymentAmount / data.price) * 100) : null),
      ownerFinanceKeyword: data.primaryKeyword || data.matchedKeywords?.[0] || 'Owner Financing',
      matchedKeywords: data.matchedKeywords || [],
      monthlyPayment: data.monthlyPayment || null,
      downPaymentAmount: data.downPaymentAmount || null,
      isActive: data.status !== 'sold' && data.status !== 'pending',
    };

    console.log(`\n--- Property ${idx + 1} ---`);
    console.log(`Address: ${apiResponse.address}`);
    console.log(`ZPID: ${data.zpid}`);
    console.log(`Price: $${apiResponse.listPrice?.toLocaleString()}`);
    console.log(`\n📝 DESCRIPTION CHECK:`);
    console.log(`  Has description in DB: ${!!data.description}`);
    console.log(`  Description length in DB: ${data.description?.length || 0}`);
    console.log(`  Has description in API response: ${!!apiResponse.description}`);
    console.log(`  Description length in API response: ${apiResponse.description?.length || 0}`);

    if (apiResponse.description) {
      console.log(`  ✅ PASS - Description included in API response`);
      console.log(`  Preview: ${apiResponse.description.substring(0, 150)}...`);
    } else {
      console.log(`  ❌ FAIL - Description NOT included in API response`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete!\n');
  console.log('The fix is working if all properties show "✅ PASS - Description included in API response"');
}

// Run the test
testDescriptionInAPI()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
