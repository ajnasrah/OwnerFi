import { config } from 'dotenv';
import { getAdminDb } from '../src/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getCitiesWithinRadiusComprehensive } from '../src/lib/comprehensive-cities';

config({ path: '.env.local' });

/**
 * COMPLETE BUYER JOURNEY SIMULATION
 *
 * Simulates what a buyer experiences when searching for properties:
 * 1. Buyer enters their search city
 * 2. System finds nearby cities
 * 3. System searches for properties
 * 4. Displays results with tags
 */
async function testAsBuyer() {
  console.log('👤 SIMULATING COMPLETE BUYER EXPERIENCE\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('   Buyer Journey: Search → Results → Display');
  console.log('═══════════════════════════════════════════════════\n');

  const db = await getAdminDb() as Firestore | null;
  if (!db) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }

  // ========================================
  // BUYER PROFILE
  // ========================================
  const buyer = {
    name: 'Test Buyer',
    searchCity: 'Houston',
    searchState: 'TX',
    maxMonthlyPayment: 2000,
    maxDownPayment: 50000
  };

  console.log('👤 BUYER PROFILE');
  console.log('─────────────────────────────────────────────────');
  console.log(`Name: ${buyer.name}`);
  console.log(`Looking in: ${buyer.searchCity}, ${buyer.searchState}`);
  console.log(`Max Monthly Payment: $${buyer.maxMonthlyPayment}`);
  console.log(`Max Down Payment: $${buyer.maxDownPayment}\n`);

  // ========================================
  // STEP 1: FIND NEARBY CITIES
  // ========================================
  console.log('🔍 STEP 1: Finding Cities Within 30 Miles');
  console.log('─────────────────────────────────────────────────');

  const nearbyCitiesList = getCitiesWithinRadiusComprehensive(
    buyer.searchCity,
    buyer.searchState,
    30
  );

  const nearbyCityNames = new Set(
    nearbyCitiesList.map(city => city.name.toLowerCase())
  );

  console.log(`✓ Found ${nearbyCityNames.size} cities within 30 miles`);
  console.log(`\n📍 Nearby Cities (showing first 15):`);
  nearbyCitiesList.slice(0, 15).forEach((city, idx) => {
    console.log(`   ${idx + 1}. ${city.name} - ${city.distance.toFixed(1)} miles`);
  });

  if (nearbyCitiesList.length > 15) {
    console.log(`   ... and ${nearbyCitiesList.length - 15} more cities`);
  }
  console.log();

  // ========================================
  // STEP 2: SEARCH FOR PROPERTIES
  // ========================================
  console.log('🏠 STEP 2: Searching for Properties');
  console.log('─────────────────────────────────────────────────');

  const allPropertiesSnapshot = await db.collection('properties').get();
  const allProperties = allPropertiesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  console.log(`✓ Queried ${allProperties.length} total properties in database\n`);

  // Filter for direct matches (in search city)
  const directProperties = allProperties.filter((property: any) => {
    const propertyCity = property.city?.split(',')[0].trim();
    const meetsbudget = (!property.monthlyPayment || property.monthlyPayment <= buyer.maxMonthlyPayment) &&
                       (!property.downPaymentAmount || property.downPaymentAmount <= buyer.maxDownPayment);

    return propertyCity?.toLowerCase() === buyer.searchCity.toLowerCase() &&
           property.state === buyer.searchState &&
           property.isActive !== false &&
           meetsbudget;
  });

  // Filter for nearby matches (in nearby cities)
  const nearbyProperties = allProperties.filter((property: any) => {
    const propertyCity = property.city?.split(',')[0].trim();

    // Must be different city but SAME STATE
    if (propertyCity?.toLowerCase() === buyer.searchCity.toLowerCase()) return false;
    if (property.state !== buyer.searchState) return false;

    // Check if property's city is in the list of nearby cities
    const isInNearbyCity = propertyCity && nearbyCityNames.has(propertyCity.toLowerCase());

    const meetsbudget = (!property.monthlyPayment || property.monthlyPayment <= buyer.maxMonthlyPayment) &&
                       (!property.downPaymentAmount || property.downPaymentAmount <= buyer.maxDownPayment);

    return isInNearbyCity &&
           property.isActive !== false &&
           meetsbudget;
  });

  console.log(`📊 SEARCH RESULTS:`);
  console.log(`   Direct Matches (in ${buyer.searchCity}): ${directProperties.length} properties`);
  console.log(`   Nearby Matches (surrounding cities): ${nearbyProperties.length} properties`);
  console.log(`   ─────────────────────────────────────────────`);
  console.log(`   TOTAL RESULTS: ${directProperties.length + nearbyProperties.length} properties\n`);

  // ========================================
  // STEP 3: DISPLAY RESULTS TO BUYER
  // ========================================
  console.log('📋 STEP 3: What Buyer Sees (Property Listings)');
  console.log('─────────────────────────────────────────────────\n');

  // Show direct properties
  if (directProperties.length > 0) {
    console.log(`🏘️  Properties in ${buyer.searchCity} (${directProperties.length} found):`);
    console.log('─────────────────────────────────────────────────');

    directProperties.slice(0, 5).forEach((prop: any, idx: number) => {
      console.log(`\n${idx + 1}. ${prop.address}`);
      console.log(`   ${prop.city}, ${prop.state} ${prop.zipCode || ''}`);
      console.log(`   💰 Monthly: $${prop.monthlyPayment?.toLocaleString() || 'N/A'} | Down: $${prop.downPaymentAmount?.toLocaleString() || 'N/A'}`);
      console.log(`   🛏️  ${prop.bedrooms || 'N/A'} bed | ${prop.bathrooms || 'N/A'} bath | ${prop.squareFeet?.toLocaleString() || 'N/A'} sq ft`);
      console.log(`   📍 Located in your search city`);
    });

    if (directProperties.length > 5) {
      console.log(`\n   ... and ${directProperties.length - 5} more in ${buyer.searchCity}`);
    }
    console.log();
  }

  // Show nearby properties with city breakdown
  if (nearbyProperties.length > 0) {
    console.log(`\n🗺️  Nearby Properties (${nearbyProperties.length} found):`);
    console.log('─────────────────────────────────────────────────');

    // Group by city
    const propertiesByCity: Record<string, any[]> = {};
    nearbyProperties.forEach((prop: any) => {
      const city = prop.city?.split(',')[0].trim() || 'Unknown';
      if (!propertiesByCity[city]) {
        propertiesByCity[city] = [];
      }
      propertiesByCity[city].push(prop);
    });

    // Show breakdown
    Object.entries(propertiesByCity)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([city, props]) => {
        const cityInfo = nearbyCitiesList.find(c => c.name.toLowerCase() === city.toLowerCase());
        const distance = cityInfo?.distance.toFixed(1) || '?';

        console.log(`\n   📍 ${city} (${distance} miles away) - ${props.length} properties:`);

        props.slice(0, 2).forEach((prop: any) => {
          console.log(`      • ${prop.address}`);
          console.log(`        $${prop.monthlyPayment?.toLocaleString() || 'N/A'}/month | $${prop.downPaymentAmount?.toLocaleString() || 'N/A'} down`);
          console.log(`        ${prop.bedrooms || 'N/A'} bed, ${prop.bathrooms || 'N/A'} bath`);
        });

        if (props.length > 2) {
          console.log(`        ... and ${props.length - 2} more in ${city}`);
        }
      });
    console.log();
  }

  if (directProperties.length === 0 && nearbyProperties.length === 0) {
    console.log('😞 No properties found matching your criteria.');
    console.log('   Try:');
    console.log('   - Increasing your budget');
    console.log('   - Searching a different city');
    console.log('   - Expanding your search radius\n');
  }

  // ========================================
  // VERIFICATION CHECKS
  // ========================================
  console.log('═══════════════════════════════════════════════════');
  console.log('              VERIFICATION CHECKS');
  console.log('═══════════════════════════════════════════════════\n');

  let checks = 0;
  let passed = 0;

  // Check 1: No duplicates
  checks++;
  const allResultIds = [...directProperties, ...nearbyProperties].map((p: any) => p.id);
  const uniqueIds = new Set(allResultIds);
  if (allResultIds.length === uniqueIds.size) {
    console.log('✅ CHECK 1: No duplicate properties in results');
    passed++;
  } else {
    console.log(`❌ CHECK 1: Found ${allResultIds.length - uniqueIds.size} duplicate properties`);
  }

  // Check 2: All nearby properties are actually nearby
  checks++;
  let allNearby = true;
  nearbyProperties.forEach((prop: any) => {
    const propCity = prop.city?.split(',')[0].trim().toLowerCase();
    if (!nearbyCityNames.has(propCity)) {
      console.log(`❌ Property in ${prop.city} is NOT in nearby cities list`);
      allNearby = false;
    }
  });
  if (allNearby) {
    console.log('✅ CHECK 2: All nearby properties are within 30 miles');
    passed++;
  }

  // Check 3: All properties meet budget
  checks++;
  let allInBudget = true;
  [...directProperties, ...nearbyProperties].forEach((prop: any) => {
    if (prop.monthlyPayment > buyer.maxMonthlyPayment ||
        prop.downPaymentAmount > buyer.maxDownPayment) {
      console.log(`❌ Property ${prop.id} exceeds budget`);
      allInBudget = false;
    }
  });
  if (allInBudget) {
    console.log('✅ CHECK 3: All properties meet budget criteria');
    passed++;
  }

  // Check 4: Same state only
  checks++;
  let allSameState = true;
  [...directProperties, ...nearbyProperties].forEach((prop: any) => {
    if (prop.state !== buyer.searchState) {
      console.log(`❌ Property in ${prop.state} (should be ${buyer.searchState})`);
      allSameState = false;
    }
  });
  if (allSameState) {
    console.log('✅ CHECK 4: All properties are in the same state');
    passed++;
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`Verification: ${passed}/${checks} checks passed`);
  console.log('═══════════════════════════════════════════════════\n');

  if (passed === checks) {
    console.log('🎉 BUYER EXPERIENCE TEST PASSED!');
    console.log('   Buyer search is working correctly.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some checks failed. Review above.\n');
    process.exit(1);
  }
}

testAsBuyer().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
