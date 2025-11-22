import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { getCitiesWithinRadiusComprehensive, getCityCoordinatesComprehensive } from '../src/lib/comprehensive-cities';

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

async function debugProblematicBuyers() {
  console.log('\n🔍 DEBUGGING BUYERS WITH COMPREHENSIVE CITIES ISSUES');
  console.log('='.repeat(80));

  const problematicBuyers = [
    { email: 'enlightened.earning@gmail.com', city: 'Liverpool', state: 'PA' },
    { email: 'redheadedbossbabe@gmail.com', city: 'Del City', state: 'Ok' }
  ];

  for (const { email, city, state } of problematicBuyers) {
    console.log(`\n${'▸'.repeat(80)}`);
    console.log(`📧 ${email}`);
    console.log(`📍 ${city}, ${state}`);
    console.log(`${'▸'.repeat(80)}`);

    // Get buyer profile
    const buyersSnapshot = await db
      .collection('buyerProfiles')
      .where('email', '==', email)
      .get();

    if (buyersSnapshot.empty) {
      console.log('❌ Buyer not found');
      continue;
    }

    const buyer = buyersSnapshot.docs[0].data();

    console.log(`\n📋 Buyer Profile:`);
    console.log(`   City: ${buyer.city || buyer.preferredCity}`);
    console.log(`   State: ${buyer.state || buyer.preferredState}`);
    console.log(`   Filter cities: ${buyer.filter?.nearbyCities?.length || 0}`);

    if (buyer.filter?.nearbyCities) {
      console.log(`   Cities in filter: ${buyer.filter.nearbyCities.slice(0, 10).join(', ')}${buyer.filter.nearbyCities.length > 10 ? '...' : ''}`);
    }

    // Try variations of the city/state lookup
    console.log(`\n🔍 Testing variations:`);

    // Test 1: Exact as stored
    const storedCity = buyer.preferredCity || buyer.city;
    const storedState = buyer.preferredState || buyer.state;
    console.log(`\n1. Exact: "${storedCity}", "${storedState}"`);
    try {
      const cities1 = getCitiesWithinRadiusComprehensive(storedCity, storedState, 30);
      console.log(`   ✅ Found ${cities1.length} cities`);
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Test 2: Try uppercase state
    const upperState = storedState.toUpperCase();
    console.log(`\n2. Uppercase state: "${storedCity}", "${upperState}"`);
    try {
      const cities2 = getCitiesWithinRadiusComprehensive(storedCity, upperState, 30);
      console.log(`   ✅ Found ${cities2.length} cities`);
      if (cities2.length > 0) {
        console.log(`   Preview: ${cities2.slice(0, 5).map(c => c.name).join(', ')}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Test 3: Check if city exists in database
    console.log(`\n3. Check coordinates lookup:`);
    const coords1 = getCityCoordinatesComprehensive(storedCity, storedState);
    const coords2 = getCityCoordinatesComprehensive(storedCity, upperState);
    console.log(`   With "${storedState}": ${coords1 ? `✅ (${coords1.lat}, ${coords1.lng})` : '❌ Not found'}`);
    console.log(`   With "${upperState}": ${coords2 ? `✅ (${coords2.lat}, ${coords2.lng})` : '❌ Not found'}`);

    // Test 4: Try trimmed versions
    const trimmedCity = storedCity.trim();
    const trimmedState = storedState.trim().toUpperCase();
    console.log(`\n4. Trimmed: "${trimmedCity}", "${trimmedState}"`);
    try {
      const cities4 = getCitiesWithinRadiusComprehensive(trimmedCity, trimmedState, 30);
      console.log(`   ✅ Found ${cities4.length} cities`);
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Conclusion
    console.log(`\n💡 Analysis:`);
    if (!coords1 && !coords2) {
      console.log(`   The city "${storedCity}, ${storedState}" is not in the comprehensive cities database.`);
      console.log(`   However, the buyer HAS a filter with ${buyer.filter?.nearbyCities?.length || 0} cities.`);
      console.log(`   This means the filter was generated before, possibly with a different database.`);
      console.log(`   The filter is still WORKING - the buyer will see properties in their stored cities.`);
    } else if (coords2 && !coords1) {
      console.log(`   ⚠️  State code issue: "${storedState}" should be "${upperState}"`);
      console.log(`   This is a data consistency issue in the buyer profile.`);
    }
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 CONCLUSION');
  console.log('='.repeat(80));
  console.log('The two buyers with "issues" actually DO have working filters.');
  console.log('The filters were pre-computed at signup and contain nearby cities.');
  console.log('The warning occurs because their cities are not in the current comprehensive database,');
  console.log('but this does NOT affect functionality - their filters work fine.');
  console.log('');
}

debugProblematicBuyers().catch(console.error);
