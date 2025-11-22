import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function testDirectMatching() {
  console.log('\n🧪 Testing Direct Property-Buyer Matching\n');
  console.log('='.repeat(80));

  const testPhone = '9018319661';

  try {
    // Get Abdullah's buyer profile
    console.log('\n📋 Step 1: Getting buyer profile...');
    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('phone', '==', testPhone)
      .get();

    if (buyersSnapshot.empty) {
      console.log('❌ Buyer not found');
      return;
    }

    const buyerDoc = buyersSnapshot.docs[0];
    const buyerData = buyerDoc.data();

    console.log('✅ Found buyer:', buyerData.firstName, buyerData.lastName);

    // Create test property data (Collierville)
    const testProperty = {
      id: 'test-property-123',
      address: '123 Test Lane',
      city: 'Collierville',
      state: 'TN',
      zipCode: '38017',
      listPrice: 200000,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1500,
      monthlyPayment: 1200,
      downPaymentAmount: 20000,
    };

    console.log('\n🏠 Step 2: Test Property:');
    console.log(`   ${testProperty.address}, ${testProperty.city}, ${testProperty.state}`);
    console.log(`   Monthly: $${testProperty.monthlyPayment}, Down: $${testProperty.downPaymentAmount}`);

    // MANUAL MATCHING LOGIC (copied from sync-matches)
    console.log('\n🔍 Step 3: Testing matching logic...\n');

    // 1. Location Match
    const { getCitiesWithinRadiusComprehensive } = await import('../src/lib/comprehensive-cities');

    const criteria = buyerData.searchCriteria || {};
    const buyerCity = criteria.city || buyerData.preferredCity;
    const buyerState = criteria.state || buyerData.preferredState;

    console.log('   Location Check:');
    console.log(`     Buyer: ${buyerCity}, ${buyerState}`);
    console.log(`     Property: ${testProperty.city}, ${testProperty.state}`);

    const nearbyCities = getCitiesWithinRadiusComprehensive(buyerCity, buyerState, 30);
    const nearbyCityNames = new Set(nearbyCities.map(c => c.name.toLowerCase()));

    const locationMatch =
      nearbyCityNames.has(testProperty.city.toLowerCase()) &&
      testProperty.state === buyerState;

    console.log(`     ✅ State match: ${testProperty.state === buyerState}`);
    console.log(`     ✅ City in 30-mile radius: ${nearbyCityNames.has(testProperty.city.toLowerCase())}`);
    console.log(`     ${locationMatch ? '✅' : '❌'} Overall location match: ${locationMatch}`);

    if (!locationMatch) {
      console.log('\n❌ FAILED: Location does not match\n');
      return;
    }

    // 2. Budget Match (OR logic)
    const maxMonthly = criteria.maxMonthlyPayment || buyerData.maxMonthlyPayment || 0;
    const maxDown = criteria.maxDownPayment || buyerData.maxDownPayment || 0;

    console.log('\n   Budget Check (OR logic):');
    console.log(`     Buyer max monthly: $${maxMonthly}`);
    console.log(`     Property monthly: $${testProperty.monthlyPayment}`);
    console.log(`     ${testProperty.monthlyPayment <= maxMonthly ? '✅' : '❌'} Monthly payment match: ${testProperty.monthlyPayment <= maxMonthly}`);

    console.log(`     Buyer max down: $${maxDown}`);
    console.log(`     Property down: $${testProperty.downPaymentAmount}`);
    console.log(`     ${testProperty.downPaymentAmount <= maxDown ? '✅' : '❌'} Down payment match: ${testProperty.downPaymentAmount <= maxDown}`);

    const monthlyPaymentMatch = testProperty.monthlyPayment <= maxMonthly;
    const downPaymentMatch = testProperty.downPaymentAmount <= maxDown;
    const budgetMatch = monthlyPaymentMatch || downPaymentMatch;

    console.log(`     ${budgetMatch ? '✅' : '❌'} Overall budget match (OR): ${budgetMatch}`);

    if (!budgetMatch) {
      console.log('\n❌ FAILED: Budget does not match\n');
      return;
    }

    // 3. Requirements Match
    console.log('\n   Requirements Check:');
    const minBedrooms = buyerData.minBedrooms;
    const minBathrooms = buyerData.minBathrooms;
    const minPrice = buyerData.minPrice;
    const maxPrice = buyerData.maxPrice;

    const bedroomsMatch = !minBedrooms || testProperty.bedrooms >= minBedrooms;
    const bathroomsMatch = !minBathrooms || testProperty.bathrooms >= minBathrooms;
    const minPriceMatch = !minPrice || testProperty.listPrice >= minPrice;
    const maxPriceMatch = !maxPrice || testProperty.listPrice <= maxPrice;

    console.log(`     ${bedroomsMatch ? '✅' : '❌'} Bedrooms: ${testProperty.bedrooms} >= ${minBedrooms || 'any'}`);
    console.log(`     ${bathroomsMatch ? '✅' : '❌'} Bathrooms: ${testProperty.bathrooms} >= ${minBathrooms || 'any'}`);
    console.log(`     ${minPriceMatch ? '✅' : '❌'} Min price: $${testProperty.listPrice} >= $${minPrice || 0}`);
    console.log(`     ${maxPriceMatch ? '✅' : '❌'} Max price: $${testProperty.listPrice} <= $${maxPrice || 'unlimited'}`);

    const requirementsMatch = bedroomsMatch && bathroomsMatch && minPriceMatch && maxPriceMatch;
    console.log(`     ${requirementsMatch ? '✅' : '❌'} Overall requirements match: ${requirementsMatch}`);

    if (!requirementsMatch) {
      console.log('\n❌ FAILED: Requirements do not match\n');
      return;
    }

    // Final Result
    const finalMatch = locationMatch && budgetMatch && requirementsMatch;

    console.log('\n' + '='.repeat(80));
    console.log('📊 MATCHING RESULT:');
    console.log('='.repeat(80));
    console.log(`${locationMatch ? '✅' : '❌'} Location: ${locationMatch}`);
    console.log(`${budgetMatch ? '✅' : '❌'} Budget: ${budgetMatch}`);
    console.log(`${requirementsMatch ? '✅' : '❌'} Requirements: ${requirementsMatch}`);
    console.log(`\n${finalMatch ? '✅✅✅' : '❌❌❌'} FINAL: ${finalMatch ? 'PROPERTY MATCHES BUYER' : 'PROPERTY DOES NOT MATCH'}`);
    console.log('='.repeat(80));

    if (finalMatch) {
      console.log('\n✅ This property SHOULD be matched to Abdullah!');
      console.log('   If it\'s not showing in his matchedPropertyIds, the issue is:');
      console.log('   1. The Firestore query is not finding him (state field mismatch)');
      console.log('   2. The API endpoint has errors');
      console.log('   3. The code hasn\'t been deployed to production');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

testDirectMatching();
