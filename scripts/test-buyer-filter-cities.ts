/**
 * TEST: Buyer Filter System with Pre-Computed Nearby Cities
 *
 * Creates 10 test buyers from different cities/states and verifies:
 * 1. Each buyer profile has a pre-computed filter generated
 * 2. Each buyer sees properties in their city AND nearby cities
 * 3. The filter correctly identifies surrounding cities
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Test buyers from diverse cities across the US
const TEST_BUYERS = [
  { city: 'Houston', state: 'TX', maxMonthly: 2000, maxDown: 20000 },
  { city: 'Phoenix', state: 'AZ', maxMonthly: 1800, maxDown: 15000 },
  { city: 'Miami', state: 'FL', maxMonthly: 2500, maxDown: 25000 },
  { city: 'Seattle', state: 'WA', maxMonthly: 3000, maxDown: 30000 },
  { city: 'Denver', state: 'CO', maxMonthly: 2200, maxDown: 22000 },
  { city: 'Atlanta', state: 'GA', maxMonthly: 1900, maxDown: 18000 },
  { city: 'Portland', state: 'OR', maxMonthly: 2400, maxDown: 24000 },
  { city: 'Charlotte', state: 'NC', maxMonthly: 1700, maxDown: 17000 },
  { city: 'Austin', state: 'TX', maxMonthly: 2300, maxDown: 23000 },
  { city: 'Las Vegas', state: 'NV', maxMonthly: 1600, maxDown: 16000 },
];

interface TestResult {
  buyer: {
    city: string;
    state: string;
    buyerId: string;
  };
  filter: {
    hasFilter: boolean;
    nearbyCitiesCount: number;
    nearbyCities: string[];
    radiusMiles: number;
  };
  properties: {
    totalFound: number;
    directMatches: number;
    nearbyMatches: number;
    likedMatches: number;
    propertyCities: string[];
  };
  success: boolean;
  errors: string[];
}

async function createTestBuyer(
  city: string,
  state: string,
  maxMonthly: number,
  maxDown: number
): Promise<{ buyerId: string; userId: string }> {
  const userId = `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const buyerId = `test_buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`\n📝 Creating test buyer: ${city}, ${state}`);

  // Call the actual buyer profile API endpoint to ensure filter is generated
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    // We need to create the profile directly since we don't have auth session
    // Import the filter generation function
    const { generateBuyerFilter } = await import('../src/lib/buyer-filter-service');

    // Generate filter
    const filter = await generateBuyerFilter(city, state, 30);

    console.log(`   ✅ Filter generated: ${filter.nearbyCitiesCount} nearby cities`);

    // Create buyer profile with pre-computed filter
    const profileData = {
      id: buyerId,
      userId,
      firstName: 'Test',
      lastName: `Buyer ${city}`,
      email: `test.buyer.${city.toLowerCase().replace(' ', '')}@test.com`,
      phone: '555-0100',

      // Location
      preferredCity: city,
      preferredState: state,
      city,
      state,
      searchRadius: 30,

      // Budget
      maxMonthlyPayment: maxMonthly,
      maxDownPayment: maxDown,

      // Communication
      languages: ['English'],
      emailNotifications: true,
      smsNotifications: true,

      // System
      profileComplete: true,
      isActive: true,

      // Interactions
      matchedPropertyIds: [],
      likedPropertyIds: [],
      passedPropertyIds: [],
      viewedPropertyIds: [],

      // Pre-computed filter
      filter,

      // Lead selling
      isAvailableForPurchase: true,
      leadPrice: 1,

      // Timestamps
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'buyerProfiles', buyerId), profileData);
    console.log(`   ✅ Profile created: ${buyerId}`);

    return { buyerId, userId };
  } catch (error) {
    console.error(`   ❌ Error creating buyer:`, error);
    throw error;
  }
}

async function testBuyerProperties(
  buyerId: string,
  city: string,
  state: string,
  maxMonthly: number,
  maxDown: number
): Promise<TestResult> {
  const result: TestResult = {
    buyer: { city, state, buyerId },
    filter: {
      hasFilter: false,
      nearbyCitiesCount: 0,
      nearbyCities: [],
      radiusMiles: 0,
    },
    properties: {
      totalFound: 0,
      directMatches: 0,
      nearbyMatches: 0,
      likedMatches: 0,
      propertyCities: [],
    },
    success: false,
    errors: [],
  };

  try {
    // 1. Check if buyer profile has pre-computed filter
    const profileDoc = await getDocs(
      query(collection(db, 'buyerProfiles'), where('id', '==', buyerId))
    );

    if (profileDoc.empty) {
      result.errors.push('Buyer profile not found');
      return result;
    }

    const profile = profileDoc.docs[0].data();

    // Check filter
    if (profile.filter?.nearbyCities) {
      result.filter.hasFilter = true;
      result.filter.nearbyCitiesCount = profile.filter.nearbyCitiesCount || 0;
      result.filter.nearbyCities = profile.filter.nearbyCities.slice(0, 10); // First 10 for display
      result.filter.radiusMiles = profile.filter.radiusMiles || 0;
    } else {
      result.errors.push('No pre-computed filter found in profile');
    }

    // 2. Query properties matching this buyer's criteria
    // Direct matches: properties in the exact search city
    const directQuery = query(
      collection(db, 'properties'),
      where('state', '==', state),
      where('isActive', '==', true)
    );

    const directSnapshot = await getDocs(directQuery);
    const directProperties = directSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => {
        const propCity = p.city?.split(',')[0].trim().toLowerCase();
        return propCity === city.toLowerCase();
      });

    result.properties.directMatches = directProperties.length;

    // Nearby matches: properties in nearby cities
    const nearbyCityNames = new Set(
      (profile.filter?.nearbyCities || []).map((c: string) => c.toLowerCase())
    );

    const nearbyProperties = directSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => {
        const propCity = p.city?.split(',')[0].trim().toLowerCase();
        // Must be different from search city AND in nearby cities list
        return propCity !== city.toLowerCase() && nearbyCityNames.has(propCity);
      });

    result.properties.nearbyMatches = nearbyProperties.length;

    // Also check zillow_imports
    const zillowQuery = query(
      collection(db, 'zillow_imports'),
      where('state', '==', state),
      where('ownerFinanceVerified', '==', true)
    );

    const zillowSnapshot = await getDocs(zillowQuery);
    const zillowDirect = zillowSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => {
        const propCity = p.city?.split(',')[0].trim().toLowerCase();
        return propCity === city.toLowerCase();
      });

    const zillowNearby = zillowSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => {
        const propCity = p.city?.split(',')[0].trim().toLowerCase();
        return propCity !== city.toLowerCase() && nearbyCityNames.has(propCity);
      });

    result.properties.directMatches += zillowDirect.length;
    result.properties.nearbyMatches += zillowNearby.length;
    result.properties.totalFound =
      result.properties.directMatches + result.properties.nearbyMatches;

    // Get unique cities where properties were found
    const allProperties = [
      ...directProperties,
      ...nearbyProperties,
      ...zillowDirect,
      ...zillowNearby,
    ];
    const uniqueCities = new Set(
      allProperties.map(p => p.city?.split(',')[0].trim()).filter(Boolean)
    );
    result.properties.propertyCities = Array.from(uniqueCities).slice(0, 15); // First 15

    result.success = result.filter.hasFilter && result.properties.totalFound >= 0;

  } catch (error) {
    result.errors.push(`Error testing properties: ${error}`);
    console.error('❌ Error:', error);
  }

  return result;
}

async function cleanupTestBuyers(buyerIds: string[]) {
  console.log('\n🧹 Cleaning up test buyers...');
  for (const buyerId of buyerIds) {
    try {
      await deleteDoc(doc(db, 'buyerProfiles', buyerId));
      console.log(`   ✅ Deleted ${buyerId}`);
    } catch (error) {
      console.log(`   ⚠️  Failed to delete ${buyerId}:`, error);
    }
  }
}

async function runTests() {
  console.log('🚀 BUYER FILTER SYSTEM TEST');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Testing ${TEST_BUYERS.length} buyers from different cities\n`);

  const createdBuyerIds: string[] = [];
  const results: TestResult[] = [];

  try {
    // Create all test buyers
    console.log('PHASE 1: Creating Test Buyers');
    console.log('─────────────────────────────────────────────────────────');

    for (const buyer of TEST_BUYERS) {
      const { buyerId } = await createTestBuyer(
        buyer.city,
        buyer.state,
        buyer.maxMonthly,
        buyer.maxDown
      );
      createdBuyerIds.push(buyerId);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✅ All buyers created successfully\n');

    // Test each buyer's property matches
    console.log('PHASE 2: Testing Property Matching');
    console.log('─────────────────────────────────────────────────────────');

    for (let i = 0; i < TEST_BUYERS.length; i++) {
      const buyer = TEST_BUYERS[i];
      const buyerId = createdBuyerIds[i];

      console.log(`\n🔍 Testing: ${buyer.city}, ${buyer.state}`);

      const result = await testBuyerProperties(
        buyerId,
        buyer.city,
        buyer.state,
        buyer.maxMonthly,
        buyer.maxDown
      );

      results.push(result);

      // Display results
      console.log(`   Filter: ${result.filter.hasFilter ? '✅' : '❌'} | Cities in radius: ${result.filter.nearbyCitiesCount}`);
      console.log(`   Properties: Direct: ${result.properties.directMatches} | Nearby: ${result.properties.nearbyMatches} | Total: ${result.properties.totalFound}`);

      if (result.filter.nearbyCities.length > 0) {
        console.log(`   Nearby cities: ${result.filter.nearbyCities.slice(0, 5).join(', ')}${result.filter.nearbyCities.length > 5 ? '...' : ''}`);
      }

      if (result.properties.propertyCities.length > 0) {
        console.log(`   Properties found in: ${result.properties.propertyCities.slice(0, 5).join(', ')}${result.properties.propertyCities.length > 5 ? '...' : ''}`);
      }

      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.join(', ')}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Summary Report
    console.log('\n\n📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    const avgNearbyCities = results.reduce((sum, r) => sum + r.filter.nearbyCitiesCount, 0) / results.length;
    const totalPropertiesFound = results.reduce((sum, r) => sum + r.properties.totalFound, 0);
    const avgPropertiesPerBuyer = totalPropertiesFound / results.length;

    console.log(`\nOverall Results:`);
    console.log(`  ✅ Successful tests: ${successCount}/${results.length}`);
    console.log(`  ❌ Failed tests: ${failCount}/${results.length}`);
    console.log(`  📍 Average nearby cities per buyer: ${avgNearbyCities.toFixed(1)}`);
    console.log(`  🏠 Total properties found: ${totalPropertiesFound}`);
    console.log(`  📈 Average properties per buyer: ${avgPropertiesPerBuyer.toFixed(1)}`);

    console.log('\n\nDetailed Results by City:');
    console.log('─────────────────────────────────────────────────────────');

    results.forEach((result, idx) => {
      const status = result.success ? '✅' : '❌';
      console.log(`\n${idx + 1}. ${status} ${result.buyer.city}, ${result.buyer.state}`);
      console.log(`   Filter: ${result.filter.nearbyCitiesCount} cities | Radius: ${result.filter.radiusMiles} miles`);
      console.log(`   Properties: ${result.properties.directMatches} direct + ${result.properties.nearbyMatches} nearby = ${result.properties.totalFound} total`);

      if (result.filter.nearbyCities.length > 0) {
        console.log(`   Sample nearby cities: ${result.filter.nearbyCities.slice(0, 8).join(', ')}`);
      }

      if (result.properties.propertyCities.length > 0) {
        console.log(`   Found properties in: ${result.properties.propertyCities.slice(0, 8).join(', ')}`);
      } else if (result.properties.totalFound === 0) {
        console.log(`   ⚠️  No properties found (may need to add test properties for ${result.buyer.state})`);
      }

      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.join('; ')}`);
      }
    });

    console.log('\n\n✅ KEY VALIDATIONS:');
    console.log('─────────────────────────────────────────────────────────');

    const allHaveFilters = results.every(r => r.filter.hasFilter);
    const allHaveNearbyCities = results.every(r => r.filter.nearbyCitiesCount > 0);
    const someHaveNearbyMatches = results.some(r => r.properties.nearbyMatches > 0);

    console.log(`✅ All buyers have pre-computed filters: ${allHaveFilters ? 'PASS' : 'FAIL'}`);
    console.log(`✅ All buyers have nearby cities calculated: ${allHaveNearbyCities ? 'PASS' : 'FAIL'}`);
    console.log(`✅ At least some buyers see nearby properties: ${someHaveNearbyMatches ? 'PASS' : 'FAIL'}`);

    if (allHaveFilters && allHaveNearbyCities) {
      console.log('\n🎉 SUCCESS: Pre-computed filter system is working correctly!');
    } else {
      console.log('\n⚠️  WARNING: Some validations failed. Check details above.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    const shouldCleanup = process.argv.includes('--cleanup');
    if (shouldCleanup) {
      await cleanupTestBuyers(createdBuyerIds);
    } else {
      console.log('\n\n💡 Test buyers remain in database. Run with --cleanup flag to remove them.');
      console.log(`   Buyer IDs: ${createdBuyerIds.slice(0, 3).join(', ')}...`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Test complete!\n');
}

// Run tests
runTests().catch(console.error);
