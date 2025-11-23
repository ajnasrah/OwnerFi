/**
 * Test Memphis buyer with new property filters
 * Simulates creating a buyer with specific preferences and seeing what properties they get
 */

import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { getCitiesWithinRadiusComprehensive } from '../src/lib/comprehensive-cities';

interface PropertyListing {
  id: string;
  city?: string;
  state?: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  listPrice?: number;
  price?: number;
  address?: string;
  fullAddress?: string;
  monthlyPayment?: number;
  source?: string;
}

interface BuyerFilters {
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minPrice?: number;
  maxPrice?: number;
}

function matchesPropertyFilters(property: PropertyListing, filters: BuyerFilters): boolean {
  // Bedrooms filter
  if (filters.minBedrooms !== undefined && property.bedrooms < filters.minBedrooms) {
    return false;
  }
  if (filters.maxBedrooms !== undefined && property.bedrooms > filters.maxBedrooms) {
    return false;
  }

  // Bathrooms filter
  if (filters.minBathrooms !== undefined && property.bathrooms < filters.minBathrooms) {
    return false;
  }
  if (filters.maxBathrooms !== undefined && property.bathrooms > filters.maxBathrooms) {
    return false;
  }

  // Square feet filter
  if (filters.minSquareFeet !== undefined && property.squareFeet && property.squareFeet < filters.minSquareFeet) {
    return false;
  }
  if (filters.maxSquareFeet !== undefined && property.squareFeet && property.squareFeet > filters.maxSquareFeet) {
    return false;
  }

  // Asking price filter
  const askingPrice = property.listPrice || property.price;
  if (filters.minPrice !== undefined && askingPrice && askingPrice < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice !== undefined && askingPrice && askingPrice > filters.maxPrice) {
    return false;
  }

  return true;
}

async function testMemphisBuyerWithFilters() {
  console.log('🧪 Testing Memphis Buyer with Property Filters\n');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  // Test buyer profile - Memphis buyer with specific preferences
  const testBuyer = {
    city: 'Memphis',
    state: 'TN',
    filters: {
      minBedrooms: 3,
      maxBedrooms: 4,
      minBathrooms: 2,
      minSquareFeet: 1500,
      maxPrice: 300000
    }
  };

  console.log('Test Buyer Profile:');
  console.log(`  Location: ${testBuyer.city}, ${testBuyer.state}`);
  console.log(`  Filters:`);
  console.log(`    - Bedrooms: ${testBuyer.filters.minBedrooms}-${testBuyer.filters.maxBedrooms}`);
  console.log(`    - Bathrooms: ${testBuyer.filters.minBathrooms}+`);
  console.log(`    - Square Feet: ${testBuyer.filters.minSquareFeet}+`);
  console.log(`    - Max Price: $${testBuyer.filters.maxPrice?.toLocaleString()}\n`);

  // Step 1: Get nearby cities
  console.log('Step 1: Calculate nearby cities (30-mile radius)');
  const nearbyCitiesList = getCitiesWithinRadiusComprehensive(testBuyer.city, testBuyer.state, 30);
  const nearbyCityNames = new Set(
    nearbyCitiesList.map(city => city.name.toLowerCase())
  );
  console.log(`  Found ${nearbyCityNames.size} cities within 30 miles`);
  console.log(`  Includes Collierville: ${nearbyCityNames.has('collierville') ? 'YES ✅' : 'NO ❌'}\n`);

  // Step 2: Query properties
  console.log('Step 2: Query properties from database');
  const propertiesQuery = query(
    collection(db, 'properties'),
    where('isActive', '==', true),
    where('state', '==', testBuyer.state),
    limit(300)
  );

  const zillowQuery = query(
    collection(db, 'zillow_imports'),
    where('state', '==', testBuyer.state),
    where('ownerFinanceVerified', '==', true),
    limit(300)
  );

  const [propertiesSnapshot, zillowSnapshot] = await Promise.all([
    getDocs(propertiesQuery),
    getDocs(zillowQuery)
  ]);

  const allProperties: PropertyListing[] = [
    ...propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<PropertyListing, 'id'>,
      source: 'curated'
    })),
    ...zillowSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<PropertyListing, 'id'>,
      source: 'zillow'
    }))
  ];

  console.log(`  Total properties in TN: ${allProperties.length}\n`);

  // Step 3: Filter by location first
  console.log('Step 3: Filter by location');
  const directProperties = allProperties.filter((property) => {
    const propertyCity = property.city?.split(',')[0].trim();
    return propertyCity?.toLowerCase() === testBuyer.city.toLowerCase();
  });

  const nearbyProperties = allProperties.filter((property) => {
    const propertyCity = property.city?.split(',')[0].trim();
    if (propertyCity?.toLowerCase() === testBuyer.city.toLowerCase()) return false;
    return propertyCity && nearbyCityNames.has(propertyCity.toLowerCase());
  });

  console.log(`  Direct (in Memphis): ${directProperties.length}`);
  console.log(`  Nearby (30-mile radius): ${nearbyProperties.length}\n`);

  // Step 4: Apply property filters
  console.log('Step 4: Apply property filters');
  const filteredDirect = directProperties.filter(p => matchesPropertyFilters(p, testBuyer.filters));
  const filteredNearby = nearbyProperties.filter(p => matchesPropertyFilters(p, testBuyer.filters));

  console.log(`  BEFORE filters:`);
  console.log(`    - Direct: ${directProperties.length}`);
  console.log(`    - Nearby: ${nearbyProperties.length}`);
  console.log(`    - Total: ${directProperties.length + nearbyProperties.length}`);

  console.log(`\n  AFTER filters:`);
  console.log(`    - Direct: ${filteredDirect.length}`);
  console.log(`    - Nearby: ${filteredNearby.length}`);
  console.log(`    - Total: ${filteredDirect.length + filteredNearby.length}\n`);

  // Step 5: Show sample properties
  console.log('Step 5: Sample filtered properties');
  const allFiltered = [...filteredDirect, ...filteredNearby];

  if (allFiltered.length > 0) {
    console.log(`\n  Showing first 5 matching properties:`);
    allFiltered.slice(0, 5).forEach((p, i) => {
      const addr = p.address || p.fullAddress || 'Unknown';
      const cityDisplay = p.city?.split(',')[0] || 'Unknown';
      const price = p.listPrice || p.price;
      console.log(`    ${i + 1}. ${cityDisplay} - ${p.bedrooms} bed, ${p.bathrooms} bath, ${p.squareFeet || '?'} sqft, $${price?.toLocaleString() || '?'}`);
      console.log(`       ${addr.substring(0, 60)}`);
    });
  } else {
    console.log(`  ⚠️  No properties match the filters`);
  }

  // Step 6: Breakdown by city
  console.log('\n  Breakdown by city:');
  const byCity: Record<string, number> = {};
  allFiltered.forEach((p) => {
    const city = p.city?.split(',')[0].trim() || 'Unknown';
    byCity[city] = (byCity[city] || 0) + 1;
  });

  Object.entries(byCity).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
    console.log(`    - ${city}: ${count} properties`);
  });

  // Final summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FINAL RESULTS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Memphis buyer sees: ${allFiltered.length} properties`);
  console.log(`  - Filters applied: ✅`);
  console.log(`  - Location filtering: ✅`);
  console.log(`  - Property requirements: ✅`);

  if (allFiltered.length > 0) {
    console.log(`\n✅ SUCCESS: Buyer sees ${allFiltered.length} filtered properties`);
  } else {
    console.log(`\n⚠️  No properties match - filters may be too restrictive or database is empty`);
  }

  // Show filter effectiveness
  const totalBeforeFilters = directProperties.length + nearbyProperties.length;
  if (totalBeforeFilters > 0) {
    const reduction = Math.round((1 - allFiltered.length / totalBeforeFilters) * 100);
    console.log(`\nFilter effectiveness:`);
    console.log(`  - Before filters: ${totalBeforeFilters} properties`);
    console.log(`  - After filters: ${allFiltered.length} properties`);
    console.log(`  - Reduction: ${reduction}% filtered out`);
  }
}

testMemphisBuyerWithFilters().catch(console.error).finally(() => process.exit(0));
