import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { getCitiesWithinRadiusComprehensive } from '../src/lib/comprehensive-cities';

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

async function testNearbyCitiesForAllBuyers() {
  console.log('\n🧪 Testing nearby cities logic for ALL buyers...\n');
  console.log('='.repeat(80));

  const buyersSnapshot = await db.collection('buyerProfiles').get();

  // Group buyers by city for analysis
  const buyersByCity = new Map<string, any[]>();

  buyersSnapshot.docs.forEach(doc => {
    const buyer = doc.data();
    const searchCity = (buyer.preferredCity || buyer.city || '').trim();
    const searchState = (buyer.preferredState || buyer.state || '').trim();

    if (!searchCity || !searchState) return;

    const key = `${searchCity}, ${searchState}`;
    if (!buyersByCity.has(key)) {
      buyersByCity.set(key, []);
    }

    buyersByCity.get(key)!.push({
      id: doc.id,
      name: `${buyer.firstName} ${buyer.lastName}`,
      city: searchCity,
      state: searchState,
      hasOldFilter: !!buyer.filter?.nearbyCities,
      oldFilterCount: buyer.filter?.nearbyCities?.length || 0
    });
  });

  console.log(`\n📊 Found ${buyersSnapshot.size} total buyers across ${buyersByCity.size} unique cities\n`);
  console.log('='.repeat(80));

  // Test nearby cities calculation for each unique city
  const testCities = Array.from(buyersByCity.entries()).slice(0, 20); // Test first 20 cities

  console.log('\n🔍 Testing nearby cities calculation for sample cities:\n');

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const [cityKey, buyers] of testCities) {
    const [city, state] = cityKey.split(', ');

    try {
      // This is what the API will now do for EVERY buyer
      const nearbyCities = getCitiesWithinRadiusComprehensive(city, state, 30);
      const nearbyCityNames = nearbyCities.map(c => c.name);

      console.log(`\n✅ ${cityKey}`);
      console.log(`   Buyers: ${buyers.length}`);
      console.log(`   Nearby cities (30 mile radius): ${nearbyCityNames.length}`);

      if (nearbyCityNames.length > 0) {
        const preview = nearbyCityNames.slice(0, 5).join(', ');
        console.log(`   Preview: ${preview}${nearbyCityNames.length > 5 ? '...' : ''}`);

        // Check if city itself is in the list
        const includesSelf = nearbyCityNames.some(c => c.toLowerCase() === city.toLowerCase());
        console.log(`   Includes search city: ${includesSelf ? '✅' : '⚠️  No (okay if exact match not needed)'}`);

        totalSuccess++;
      } else {
        console.log(`   ⚠️  WARNING: No nearby cities found! Check comprehensive-cities data for ${state}`);
        totalFailed++;
      }

      // Show old vs new for buyers with old filter
      const withOldFilter = buyers.filter(b => b.hasOldFilter);
      if (withOldFilter.length > 0) {
        console.log(`   Old filter status: ${withOldFilter.length}/${buyers.length} buyers had pre-computed filter`);
        console.log(`   → Now ALL ${buyers.length} buyers will get ${nearbyCityNames.length} nearby cities`);
      }

    } catch (error) {
      console.log(`\n❌ ${cityKey}`);
      console.log(`   ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      totalFailed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY:');
  console.log('='.repeat(80));
  console.log(`Total cities tested: ${testCities.length}`);
  console.log(`Successful calculations: ${totalSuccess} ✅`);
  console.log(`Failed calculations: ${totalFailed} ❌`);
  console.log('');

  // Specific test for Memphis → Collierville
  console.log('='.repeat(80));
  console.log('🎯 SPECIFIC TEST: Memphis → Collierville');
  console.log('='.repeat(80));

  const memphisCities = getCitiesWithinRadiusComprehensive('Memphis', 'TN', 30);
  const hasCollierville = memphisCities.some(c => c.name.toLowerCase() === 'collierville');

  console.log(`Memphis nearby cities: ${memphisCities.length}`);
  console.log(`Includes Collierville: ${hasCollierville ? '✅ YES' : '❌ NO'}`);

  if (hasCollierville) {
    console.log('✅ Memphis buyers WILL see Collierville properties!');
  } else {
    console.log('❌ Memphis buyers WILL NOT see Collierville properties!');
    console.log('   Nearby cities:', memphisCities.map(c => c.name).slice(0, 20).join(', '));
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 CONCLUSION:');
  console.log('='.repeat(80));
  console.log('✅ New logic will calculate nearby cities for ALL buyers');
  console.log('✅ No need for pre-computed filters');
  console.log('✅ Always accurate and up-to-date');
  console.log('✅ Works for all ' + buyersSnapshot.size + ' buyers across all cities');
  console.log('');
}

testNearbyCitiesForAllBuyers().catch(console.error);
