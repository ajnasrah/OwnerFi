/**
 * Test Memphis buyer to confirm properties from Memphis + Collierville
 * NO BUDGET FILTERING
 */

import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { getCitiesWithinRadiusComprehensive } from '../src/lib/comprehensive-cities';

async function testMemphisBuyer() {
  console.log('🧪 Testing Memphis Buyer - Real Database Test\n');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  const searchCity = 'Memphis';
  const searchState = 'TN';

  // Step 1: Get nearby cities (same logic as API)
  console.log('Step 1: Calculate nearby cities (30-mile radius)');
  const nearbyCitiesList = getCitiesWithinRadiusComprehensive(searchCity, searchState, 30);
  const nearbyCityNames = new Set(
    nearbyCitiesList.map(city => city.name.toLowerCase())
  );

  console.log(`  Found ${nearbyCityNames.size} cities within 30 miles of Memphis:`);
  const citiesArray = Array.from(nearbyCityNames).sort();
  citiesArray.forEach((city, i) => {
    if (i < 10) console.log(`    - ${city}`);
  });
  if (citiesArray.length > 10) {
    console.log(`    ... and ${citiesArray.length - 10} more`);
  }

  const hasCollierville = nearbyCityNames.has('collierville');
  console.log(`\n  ✅ Collierville included: ${hasCollierville ? 'YES' : 'NO'}\n`);

  // Step 2: Query properties (curated)
  console.log('Step 2: Query curated properties');
  const propertiesQuery = query(
    collection(db, 'properties'),
    where('isActive', '==', true),
    where('state', '==', searchState),
    limit(300)
  );

  const propertiesSnapshot = await getDocs(propertiesQuery);
  console.log(`  Fetched ${propertiesSnapshot.docs.length} active properties in TN\n`);

  // Step 3: Query Zillow properties
  console.log('Step 3: Query Zillow scraped properties');
  const zillowQuery = query(
    collection(db, 'zillow_imports'),
    where('state', '==', searchState),
    where('ownerFinanceVerified', '==', true),
    limit(300)
  );

  const zillowSnapshot = await getDocs(zillowQuery);
  console.log(`  Fetched ${zillowSnapshot.docs.length} Zillow properties in TN\n`);

  // Step 4: Combine and filter
  const allProperties = [
    ...propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'curated'
    })),
    ...zillowSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'zillow'
    }))
  ];

  console.log(`Total properties in TN: ${allProperties.length}\n`);

  // Step 5: Filter by location (NO BUDGET FILTERING)
  console.log('Step 4: Filter properties (Location Only - NO Budget)');

  const directProperties = allProperties.filter((property: any) => {
    const propertyCity = property.city?.split(',')[0].trim();
    return propertyCity?.toLowerCase() === searchCity.toLowerCase();
  });

  const nearbyProperties = allProperties.filter((property: any) => {
    const propertyCity = property.city?.split(',')[0].trim();
    if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;
    return propertyCity && nearbyCityNames.has(propertyCity.toLowerCase());
  });

  console.log(`\n  Direct matches (in Memphis): ${directProperties.length}`);
  directProperties.forEach((p: any, i: number) => {
    if (i < 5) {
      const addr = p.address || p.fullAddress || 'Unknown';
      const monthly = p.monthlyPayment ? `$${p.monthlyPayment}/mo` : 'TBD';
      console.log(`    ${i + 1}. ${addr} - ${monthly} (${p.source})`);
    }
  });

  console.log(`\n  Nearby matches (within 30 miles): ${nearbyProperties.length}`);

  // Group by city
  const byCity: Record<string, number> = {};
  nearbyProperties.forEach((p: any) => {
    const city = p.city?.split(',')[0].trim() || 'Unknown';
    byCity[city] = (byCity[city] || 0) + 1;
  });

  const sortedCities = Object.entries(byCity).sort((a, b) => b[1] - a[1]);
  sortedCities.forEach(([city, count]) => {
    console.log(`    - ${city}: ${count} properties`);
  });

  const colliervilleProperties = nearbyProperties.filter((p: any) => {
    const city = p.city?.split(',')[0].trim()?.toLowerCase();
    return city === 'collierville';
  });

  console.log(`\n  Collierville properties: ${colliervilleProperties.length}`);
  if (colliervilleProperties.length > 0) {
    console.log(`  ✅ Collierville properties ARE showing`);
    colliervilleProperties.forEach((p: any, i: number) => {
      if (i < 3) {
        const addr = p.address || p.fullAddress || 'Unknown';
        console.log(`    ${i + 1}. ${addr}`);
      }
    });
  } else {
    console.log(`  ⚠️  No Collierville properties found in database`);
  }

  const totalResults = directProperties.length + nearbyProperties.length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FINAL RESULTS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total properties shown to Memphis buyer: ${totalResults}`);
  console.log(`  - Direct (in Memphis): ${directProperties.length}`);
  console.log(`  - Nearby (30-mile radius): ${nearbyProperties.length}`);
  console.log(`  - Including Collierville: ${colliervilleProperties.length}`);
  console.log(`\n✅ Budget filtering: DISABLED`);
  console.log(`✅ Location filtering: ACTIVE (30-mile radius)`);
  console.log(`✅ Collierville in radius: ${hasCollierville ? 'YES' : 'NO'}`);
  console.log(`${colliervilleProperties.length > 0 ? '✅' : '⚠️ '} Collierville properties: ${colliervilleProperties.length}`);

  if (totalResults >= 11) {
    console.log(`\n✅ SUCCESS: Memphis buyer sees ${totalResults} properties`);
  } else if (totalResults > 0) {
    console.log(`\n⚠️  Memphis buyer sees ${totalResults} properties`);
  } else {
    console.log(`\n❌ No properties found - database may be empty for TN`);
  }

  // Show breakdown by price range (no filtering applied)
  if (directProperties.length > 0) {
    const withPrices = directProperties.filter((p: any) => p.monthlyPayment);
    const prices = withPrices.map((p: any) => p.monthlyPayment).sort((a, b) => a - b);
    if (prices.length > 0) {
      console.log(`\nPrice range of direct matches:`);
      console.log(`  Lowest: $${prices[0]}/mo`);
      console.log(`  Highest: $${prices[prices.length - 1]}/mo`);
      console.log(`  ✅ All prices shown (no budget filter applied)`);
    }
  }
}

testMemphisBuyer().catch(console.error).finally(() => process.exit(0));
