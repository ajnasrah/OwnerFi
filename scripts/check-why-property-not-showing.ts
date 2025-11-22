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

async function checkWhyPropertyNotShowing() {
  try {
    const propertyId = 'V9Ief0n5cPPpB53JNo3F';

    console.log('\n🔍 Checking why property is not showing...\n');
    console.log('='.repeat(80));

    // Get the property
    const propertyDoc = await db.collection('properties').doc(propertyId).get();

    if (!propertyDoc.exists) {
      console.log('❌ Property not found in database!');
      return;
    }

    const property = propertyDoc.data();

    console.log('📋 Property Details:');
    console.log(`Address: ${property?.address}`);
    console.log(`City: ${property?.city}`);
    console.log(`State: ${property?.state}`);
    console.log(`Monthly Payment: $${property?.monthlyPayment}`);
    console.log(`Down Payment: $${property?.downPaymentAmount}`);
    console.log(`Status: ${property?.status}`);
    console.log(`isActive: ${property?.isActive}`);

    // Get all buyer profiles to see who should be able to see this
    const buyersSnapshot = await db.collection('buyerProfiles').get();

    console.log(`\n👥 Checking ${buyersSnapshot.size} buyer profiles...\n`);
    console.log('='.repeat(80));

    let matchCount = 0;

    buyersSnapshot.docs.forEach((doc) => {
      const buyer = doc.data();

      const stateMatch = buyer.preferredState === property?.state || buyer.state === property?.state;
      const monthlyBudgetMatch = !property?.monthlyPayment || (buyer.maxMonthlyPayment >= property.monthlyPayment);
      const downBudgetMatch = !property?.downPaymentAmount || (buyer.maxDownPayment >= property.downPaymentAmount);

      // Check if buyer's preferred city or search criteria includes Collierville or nearby
      const cityMatch =
        buyer.preferredCity?.toLowerCase() === property?.city?.toLowerCase() ||
        buyer.city?.toLowerCase() === property?.city?.toLowerCase() ||
        buyer.filter?.nearbyCities?.some((c: string) => c.toLowerCase() === property?.city?.toLowerCase());

      const overallMatch = stateMatch && monthlyBudgetMatch && downBudgetMatch && cityMatch;

      if (overallMatch) {
        matchCount++;
        console.log(`✅ MATCH: ${buyer.firstName} ${buyer.lastName}`);
        console.log(`   City: ${buyer.preferredCity || buyer.city}`);
        console.log(`   State: ${buyer.preferredState || buyer.state}`);
        console.log(`   Budget: $${buyer.maxMonthlyPayment}/mo, $${buyer.maxDownPayment} down`);
        console.log(`   Nearby cities: ${buyer.filter?.nearbyCities?.length || 0} cities`);
        console.log('');
      } else {
        // Show WHY it doesn't match
        if (!stateMatch && (buyer.preferredState || buyer.state)) {
          console.log(`❌ NO MATCH: ${buyer.firstName} ${buyer.lastName}`);
          console.log(`   ❌ State mismatch: Buyer wants ${buyer.preferredState || buyer.state}, property is in ${property?.state}`);
        } else if (!monthlyBudgetMatch) {
          console.log(`❌ NO MATCH: ${buyer.firstName} ${buyer.lastName}`);
          console.log(`   ❌ Monthly budget: Buyer max $${buyer.maxMonthlyPayment}/mo, property is $${property?.monthlyPayment}/mo`);
        } else if (!downBudgetMatch) {
          console.log(`❌ NO MATCH: ${buyer.firstName} ${buyer.lastName}`);
          console.log(`   ❌ Down payment budget: Buyer max $${buyer.maxDownPayment}, property needs $${property?.downPaymentAmount}`);
        } else if (!cityMatch) {
          console.log(`❌ NO MATCH: ${buyer.firstName} ${buyer.lastName}`);
          console.log(`   ❌ City/location: Buyer searching in ${buyer.preferredCity || buyer.city}, property is in ${property?.city}`);
          console.log(`   Nearby cities count: ${buyer.filter?.nearbyCities?.length || 0}`);
          if (buyer.filter?.nearbyCities && buyer.filter.nearbyCities.length > 0) {
            const nearbyList = buyer.filter.nearbyCities.slice(0, 10).join(', ');
            console.log(`   Nearby cities: ${nearbyList}${buyer.filter.nearbyCities.length > 10 ? '...' : ''}`);
          }
        }
        console.log('');
      }
    });

    console.log('='.repeat(80));
    console.log(`\n📊 Summary: ${matchCount} buyer(s) should see this property\n`);

    if (matchCount === 0) {
      console.log('💡 Reasons property might not be showing:');
      console.log('1. No buyers are searching in Collierville, TN');
      console.log('2. Collierville is not in any buyer\'s nearby cities list');
      console.log('3. Buyers have lower budget than $1,660/mo or $100,000 down');
      console.log('4. Buyers are searching in different states');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWhyPropertyNotShowing();
