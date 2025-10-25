import { config } from 'dotenv';
import { getAdminDb } from '../src/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getCitiesWithinRadiusComprehensive } from '../src/lib/comprehensive-cities';

// Load environment variables
config({ path: '.env.local' });

async function testBuyerSearchLogic() {
  console.log('🧪 Testing Buyer Search Logic with Nearby Cities\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('         BUYER SEARCH NEARBY CITIES TEST');
  console.log('═══════════════════════════════════════════════════\n');

  const db = await getAdminDb() as Firestore | null;

  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    process.exit(1);
  }

  // Test scenario: Buyer searches Memphis, TN
  const buyerCity = 'Memphis';
  const buyerState = 'TN';
  const maxMonthlyPayment = 2000;
  const maxDownPayment = 50000;

  console.log(`📍 Test Scenario:`);
  console.log(`   Buyer searches: ${buyerCity}, ${buyerState}`);
  console.log(`   Max Monthly: $${maxMonthlyPayment}`);
  console.log(`   Max Down: $${maxDownPayment}\n`);

  // Step 1: Get nearby cities (what the API now does)
  console.log('Step 1: Getting cities within 30 miles of Memphis...');
  const nearbyCitiesList = getCitiesWithinRadiusComprehensive(buyerCity, buyerState, 30);
  const nearbyCityNames = new Set(
    nearbyCitiesList.map(city => city.name.toLowerCase())
  );

  console.log(`✓ Found ${nearbyCityNames.size} nearby cities`);
  console.log(`✓ Includes: ${Array.from(nearbyCityNames).slice(0, 8).join(', ')}...\n`);

  // Check if Bartlett is in the list
  const hasBartlett = nearbyCityNames.has('bartlett');
  console.log(`${hasBartlett ? '✅' : '❌'} Bartlett is ${hasBartlett ? '' : 'NOT '}in nearby cities list\n`);

  // Step 2: Get all properties
  console.log('Step 2: Querying all properties from database...');
  const propertiesSnapshot = await db.collection('properties').get();
  const allProperties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`✓ Found ${allProperties.length} total properties\n`);

  // Step 3: Filter for direct matches (in Memphis)
  const directProperties = allProperties.filter((property: any) => {
    const propertyCity = property.city?.split(',')[0].trim();
    const meetsbudget = (!property.monthlyPayment || property.monthlyPayment <= maxMonthlyPayment) &&
                       (!property.downPaymentAmount || property.downPaymentAmount <= maxDownPayment);
    return propertyCity?.toLowerCase() === buyerCity.toLowerCase() &&
           property.state === buyerState &&
           property.isActive !== false &&
           meetsbudget;
  });

  console.log(`Step 3: Direct matches (properties IN ${buyerCity})`);
  console.log(`✓ Found ${directProperties.length} properties directly in ${buyerCity}\n`);

  // Step 4: Filter for nearby matches (in nearby cities)
  const nearbyProperties = allProperties.filter((property: any) => {
    const propertyCity = property.city?.split(',')[0].trim();

    // Must be different city but SAME STATE
    if (propertyCity?.toLowerCase() === buyerCity.toLowerCase()) return false;
    if (property.state !== buyerState) return false;

    // Check if property's city is in the list of nearby cities
    const isInNearbyCity = propertyCity && nearbyCityNames.has(propertyCity.toLowerCase());

    // Show properties if they have no pricing data OR meet both budget criteria
    const meetsbudget = (!property.monthlyPayment || property.monthlyPayment <= maxMonthlyPayment) &&
                       (!property.downPaymentAmount || property.downPaymentAmount <= maxDownPayment);

    return isInNearbyCity &&
           property.isActive !== false &&
           meetsbudget;
  });

  console.log(`Step 4: Nearby matches (properties in cities within 30 miles)`);
  console.log(`✓ Found ${nearbyProperties.length} properties in nearby cities\n`);

  // Count properties by city
  const propertiesByCity: Record<string, number> = {};
  nearbyProperties.forEach((prop: any) => {
    const city = prop.city?.split(',')[0].trim() || 'Unknown';
    propertiesByCity[city] = (propertiesByCity[city] || 0) + 1;
  });

  // Show breakdown
  if (Object.keys(propertiesByCity).length > 0) {
    console.log('   Breakdown by city:');
    Object.entries(propertiesByCity)
      .sort(([,a], [,b]) => b - a)
      .forEach(([city, count]) => {
        const distance = nearbyCitiesList.find(c => c.name.toLowerCase() === city.toLowerCase())?.distance || 0;
        console.log(`   - ${city}: ${count} properties (${distance.toFixed(1)} miles)`);
      });
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('                    SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Buyer searches: ${buyerCity}, ${buyerState}`);
  console.log(`Direct matches: ${directProperties.length} properties`);
  console.log(`Nearby matches: ${nearbyProperties.length} properties`);
  console.log(`Total results: ${directProperties.length + nearbyProperties.length} properties`);

  if (propertiesByCity['Bartlett']) {
    console.log(`\n✅ SUCCESS: Bartlett properties (${propertiesByCity['Bartlett']}) are shown to Memphis buyers!`);
  } else if (nearbyProperties.length > 0) {
    console.log(`\n✅ Nearby search working, but no Bartlett properties in budget`);
  } else {
    console.log(`\n⚠️  No nearby properties found (might be budget constraints)`);
  }

  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

testBuyerSearchLogic().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
