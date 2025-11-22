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

async function checkBuyerVisibility() {
  const propertyId = 'V9Ief0n5cPPpB53JNo3F';

  // Get property
  const propDoc = await db.collection('properties').doc(propertyId).get();
  const prop = propDoc.data();

  console.log('\n🏠 Property: ' + prop?.address + ', ' + prop?.city + ', ' + prop?.state);
  console.log('💰 Price: $' + prop?.price + ', Monthly: $' + prop?.monthlyPayment + ', Down: $' + prop?.downPaymentAmount);
  console.log('✅ Status: ' + prop?.status + ', Active: ' + prop?.isActive);
  console.log('');

  // Check how many buyers are searching in TN
  const buyersSnapshot = await db.collection('buyerProfiles').get();

  let tnBuyers = 0;
  let matchingBuyers = 0;
  let withinBudget = 0;
  let noNearbyCities = 0;

  console.log('👥 Checking buyers...\n');

  buyersSnapshot.docs.forEach(doc => {
    const buyer = doc.data();
    const searchState = buyer.preferredState || buyer.state;

    if (searchState === 'TN') {
      tnBuyers++;

      const budgetOk =
        (buyer.maxMonthlyPayment >= prop?.monthlyPayment) &&
        (buyer.maxDownPayment >= prop?.downPaymentAmount);

      if (budgetOk) {
        withinBudget++;

        const cityMatch =
          buyer.preferredCity?.toLowerCase() === prop?.city?.toLowerCase() ||
          buyer.city?.toLowerCase() === prop?.city?.toLowerCase() ||
          buyer.filter?.nearbyCities?.some((c: string) => c.toLowerCase() === prop?.city?.toLowerCase());

        if (cityMatch) {
          matchingBuyers++;
          console.log('✅ MATCH: ' + buyer.firstName + ' ' + buyer.lastName);
          console.log('   Searching: ' + (buyer.preferredCity || buyer.city) + ', TN');
          console.log('   Budget: $' + buyer.maxMonthlyPayment + '/mo, $' + buyer.maxDownPayment + ' down');
          console.log('   Nearby cities: ' + (buyer.filter?.nearbyCities?.length || 0) + ' cities');
          console.log('');
        } else {
          // Check if issue is nearby cities
          const searchingInMemphis =
            buyer.preferredCity?.toLowerCase() === 'memphis' ||
            buyer.city?.toLowerCase() === 'memphis';

          if (searchingInMemphis && (!buyer.filter?.nearbyCities || buyer.filter.nearbyCities.length === 0)) {
            noNearbyCities++;
            console.log('⚠️  ALMOST: ' + buyer.firstName + ' ' + buyer.lastName);
            console.log('   Searching: Memphis, TN (property is in Collierville)');
            console.log('   Budget: $' + buyer.maxMonthlyPayment + '/mo, $' + buyer.maxDownPayment + ' down');
            console.log('   ❌ Issue: No nearby cities filter (needs to be populated)');
            console.log('');
          }
        }
      }
    }
  });

  console.log('='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(80));
  console.log('Total buyers searching in TN: ' + tnBuyers);
  console.log('With sufficient budget: ' + withinBudget);
  console.log('Who WILL see this property: ' + matchingBuyers);
  console.log('Who WOULD see it (if nearby cities populated): ' + noNearbyCities);
  console.log('');

  if (matchingBuyers === 0 || noNearbyCities > 0) {
    console.log('💡 SOLUTIONS:');
    console.log('');
    console.log('1. IMMEDIATE FIX: Populate nearby cities filters');
    console.log('   - This will make Collierville show up for Memphis searches');
    console.log('   - Run: npm run migrate-buyer-filters (or similar)');
    console.log('');
    console.log('2. OR: Make TN buyers see ALL TN properties');
    console.log('   - Remove city filter for same-state properties');
    console.log('   - Simpler but shows more properties');
    console.log('');
    console.log('3. OR: Add Collierville to nearbyCities manually for Memphis buyers');
    console.log('');
  } else {
    console.log('✅ Property is visible to buyers!');
  }
}

checkBuyerVisibility().catch(console.error);
