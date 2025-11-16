/**
 * IMPROVED BUYER FILTER SYSTEM TEST
 *
 * Comprehensive validation of:
 * 1. Filter generation consistency
 * 2. Geographic accuracy (cities are actually within radius)
 * 3. Performance metrics
 * 4. Data integrity
 * 5. Edge cases
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

// Test buyers from diverse geographic regions
const TEST_BUYERS = [
  { city: 'Houston', state: 'TX', maxMonthly: 2000, maxDown: 20000, region: 'Southwest' },
  { city: 'Phoenix', state: 'AZ', maxMonthly: 1800, maxDown: 15000, region: 'Southwest' },
  { city: 'Miami', state: 'FL', maxMonthly: 2500, maxDown: 25000, region: 'Southeast' },
  { city: 'Seattle', state: 'WA', maxMonthly: 3000, maxDown: 30000, region: 'Northwest' },
  { city: 'Denver', state: 'CO', maxMonthly: 2200, maxDown: 22000, region: 'Mountain' },
  { city: 'Atlanta', state: 'GA', maxMonthly: 1900, maxDown: 18000, region: 'Southeast' },
  { city: 'Portland', state: 'OR', maxMonthly: 2400, maxDown: 24000, region: 'Northwest' },
  { city: 'Charlotte', state: 'NC', maxMonthly: 1700, maxDown: 17000, region: 'Southeast' },
  { city: 'Austin', state: 'TX', maxMonthly: 2300, maxDown: 23000, region: 'Southwest' },
  { city: 'Las Vegas', state: 'NV', maxMonthly: 1600, maxDown: 16000, region: 'Southwest' },
];

interface ValidationResult {
  test: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

interface TestResult {
  buyer: {
    city: string;
    state: string;
    region: string;
    buyerId: string;
  };
  filter: {
    hasFilter: boolean;
    nearbyCitiesCount: number;
    radiusMiles: number;
    hasGeohash: boolean;
    hasBoundingBox: boolean;
    generationTimeMs: number;
  };
  properties: {
    totalFound: number;
    directMatches: number;
    nearbyMatches: number;
    propertyCities: string[];
  };
  validations: ValidationResult[];
  success: boolean;
}

// Haversine distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function createTestBuyer(
  city: string,
  state: string,
  maxMonthly: number,
  maxDown: number
): Promise<{ buyerId: string; userId: string; generationTimeMs: number }> {
  const userId = `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const buyerId = `test_buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const startTime = Date.now();

  const { generateBuyerFilter } = await import('../src/lib/buyer-filter-service');
  const filter = await generateBuyerFilter(city, state, 30);
  const generationTimeMs = Date.now() - startTime;

  const profileData = {
    id: buyerId,
    userId,
    firstName: 'Test',
    lastName: `Buyer ${city}`,
    email: `test.buyer.${city.toLowerCase().replace(/\s+/g, '')}@test.com`,
    phone: '555-0100',
    preferredCity: city,
    preferredState: state,
    city,
    state,
    searchRadius: 30,
    maxMonthlyPayment: maxMonthly,
    maxDownPayment: maxDown,
    languages: ['English'],
    emailNotifications: true,
    smsNotifications: true,
    profileComplete: true,
    isActive: true,
    matchedPropertyIds: [],
    likedPropertyIds: [],
    passedPropertyIds: [],
    viewedPropertyIds: [],
    filter,
    isAvailableForPurchase: true,
    leadPrice: 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(doc(db, 'buyerProfiles', buyerId), profileData);

  return { buyerId, userId, generationTimeMs };
}

async function validateFilter(
  buyerId: string,
  city: string,
  state: string
): Promise<ValidationResult[]> {
  const validations: ValidationResult[] = [];

  try {
    // Get profile
    const profileDoc = await getDocs(
      query(collection(db, 'buyerProfiles'), where('id', '==', buyerId))
    );

    if (profileDoc.empty) {
      validations.push({
        test: 'Profile Exists',
        passed: false,
        details: 'Buyer profile not found',
        severity: 'critical',
      });
      return validations;
    }

    const profile = profileDoc.docs[0].data();
    const filter = profile.filter;

    // 1. Filter exists
    validations.push({
      test: 'Filter Exists',
      passed: !!filter,
      details: filter ? 'Pre-computed filter found' : 'No filter in profile',
      severity: 'critical',
    });

    if (!filter) return validations;

    // 2. Has nearby cities
    validations.push({
      test: 'Nearby Cities Generated',
      passed: filter.nearbyCities && filter.nearbyCities.length > 0,
      details: `${filter.nearbyCities?.length || 0} nearby cities`,
      severity: 'critical',
    });

    // 3. Search city is included
    const cityNames = new Set((filter.nearbyCities || []).map((c: string) => c.toLowerCase()));
    const searchCityIncluded = cityNames.has(city.toLowerCase());
    validations.push({
      test: 'Search City Included',
      passed: searchCityIncluded,
      details: searchCityIncluded
        ? `${city} found in nearby cities`
        : `${city} NOT in nearby cities list`,
      severity: 'critical',
    });

    // 4. Count matches array length
    const countMatches = filter.nearbyCitiesCount === filter.nearbyCities?.length;
    validations.push({
      test: 'Count Consistency',
      passed: countMatches,
      details: `Count: ${filter.nearbyCitiesCount}, Actual: ${filter.nearbyCities?.length}`,
      severity: 'warning',
    });

    // 5. Radius is set correctly
    validations.push({
      test: 'Radius Configuration',
      passed: filter.radiusMiles === 30,
      details: `Radius: ${filter.radiusMiles} miles`,
      severity: 'critical',
    });

    // 6. Has bounding box
    validations.push({
      test: 'Bounding Box Present',
      passed: !!filter.boundingBox,
      details: filter.boundingBox
        ? `Lat: [${filter.boundingBox.minLat.toFixed(2)}, ${filter.boundingBox.maxLat.toFixed(2)}], Lng: [${filter.boundingBox.minLng.toFixed(2)}, ${filter.boundingBox.maxLng.toFixed(2)}]`
        : 'No bounding box',
      severity: 'warning',
    });

    // 7. Has geohash
    validations.push({
      test: 'Geohash Generated',
      passed: !!filter.geohashPrefix,
      details: filter.geohashPrefix || 'No geohash',
      severity: 'info',
    });

    // 8. Timestamp is recent
    const now = Timestamp.now();
    const ageSeconds = now.seconds - filter.lastCityUpdate.seconds;
    validations.push({
      test: 'Filter Freshness',
      passed: ageSeconds < 60,
      details: `Generated ${ageSeconds} seconds ago`,
      severity: 'info',
    });

    // 9. Validate geographic accuracy (sample a few cities)
    const { getCityCoordinatesComprehensive } = await import('../src/lib/comprehensive-cities');
    const centerCoords = getCityCoordinatesComprehensive(city, state);

    if (centerCoords && filter.nearbyCities && filter.nearbyCities.length > 0) {
      // Check a sample of 5 cities
      const sampleSize = Math.min(5, filter.nearbyCities.length);
      const sampleCities = filter.nearbyCities.slice(0, sampleSize);
      let allWithinRadius = true;
      const distances: string[] = [];

      for (const nearbyCity of sampleCities) {
        const nearbyCoords = getCityCoordinatesComprehensive(nearbyCity, state);
        if (nearbyCoords) {
          const distance = calculateDistance(
            centerCoords.lat,
            centerCoords.lng,
            nearbyCoords.lat,
            nearbyCoords.lng
          );
          distances.push(`${nearbyCity}: ${distance.toFixed(1)}mi`);

          if (distance > 35) {
            // Allow 5 mile buffer for metro areas
            allWithinRadius = false;
          }
        }
      }

      validations.push({
        test: 'Geographic Accuracy',
        passed: allWithinRadius,
        details: distances.join(', '),
        severity: 'warning',
      });
    }

  } catch (error) {
    validations.push({
      test: 'Validation Error',
      passed: false,
      details: `Error: ${error}`,
      severity: 'critical',
    });
  }

  return validations;
}

async function testPropertyMatching(
  buyerId: string,
  city: string,
  state: string
): Promise<{
  totalFound: number;
  directMatches: number;
  nearbyMatches: number;
  propertyCities: string[];
  validations: ValidationResult[];
}> {
  const validations: ValidationResult[] = [];

  try {
    // Get buyer profile
    const profileDoc = await getDocs(
      query(collection(db, 'buyerProfiles'), where('id', '==', buyerId))
    );

    if (profileDoc.empty) {
      return {
        totalFound: 0,
        directMatches: 0,
        nearbyMatches: 0,
        propertyCities: [],
        validations: [{
          test: 'Property Query',
          passed: false,
          details: 'Profile not found',
          severity: 'critical',
        }],
      };
    }

    const profile = profileDoc.docs[0].data();
    const nearbyCityNames = new Set(
      (profile.filter?.nearbyCities || []).map((c: string) => c.toLowerCase())
    );

    // Query properties
    const directQuery = query(
      collection(db, 'properties'),
      where('state', '==', state),
      where('isActive', '==', true)
    );

    const zillowQuery = query(
      collection(db, 'zillow_imports'),
      where('state', '==', state),
      where('ownerFinanceVerified', '==', true)
    );

    const [propertiesSnapshot, zillowSnapshot] = await Promise.all([
      getDocs(directQuery),
      getDocs(zillowQuery),
    ]);

    const allProperties = [
      ...propertiesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
      ...zillowSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
    ];

    // Categorize properties
    let directMatches = 0;
    let nearbyMatches = 0;
    let outsideRadius = 0;
    const propertyCities = new Set<string>();

    allProperties.forEach(p => {
      const propCity = p.city?.split(',')[0].trim().toLowerCase();
      if (!propCity) return;

      propertyCities.add(p.city?.split(',')[0].trim());

      if (propCity === city.toLowerCase()) {
        directMatches++;
      } else if (nearbyCityNames.has(propCity)) {
        nearbyMatches++;
      } else {
        outsideRadius++;
      }
    });

    // Validations
    validations.push({
      test: 'Properties Found',
      passed: allProperties.length > 0,
      details: `${allProperties.length} properties in ${state}`,
      severity: allProperties.length === 0 ? 'warning' : 'info',
    });

    validations.push({
      test: 'Filter Applied Correctly',
      passed: outsideRadius === 0 || nearbyCityNames.size === 0,
      details: outsideRadius > 0
        ? `${outsideRadius} properties outside filter radius`
        : 'All properties within filter',
      severity: 'info',
    });

    validations.push({
      test: 'Nearby Cities Working',
      passed: nearbyMatches > 0 || directMatches > 0,
      details: nearbyMatches > 0
        ? `Found ${nearbyMatches} properties in nearby cities`
        : 'No nearby matches (may be expected if no properties exist)',
      severity: nearbyMatches === 0 ? 'info' : 'info',
    });

    return {
      totalFound: directMatches + nearbyMatches,
      directMatches,
      nearbyMatches,
      propertyCities: Array.from(propertyCities),
      validations,
    };

  } catch (error) {
    return {
      totalFound: 0,
      directMatches: 0,
      nearbyMatches: 0,
      propertyCities: [],
      validations: [{
        test: 'Property Query',
        passed: false,
        details: `Error: ${error}`,
        severity: 'critical',
      }],
    };
  }
}

async function cleanupTestBuyers(buyerIds: string[]) {
  console.log('\n🧹 Cleaning up test buyers...');
  for (const buyerId of buyerIds) {
    try {
      await deleteDoc(doc(db, 'buyerProfiles', buyerId));
      console.log(`   ✅ Deleted ${buyerId}`);
    } catch (error) {
      console.log(`   ⚠️  Failed to delete ${buyerId}`);
    }
  }
}

async function runTests() {
  console.log('🚀 IMPROVED BUYER FILTER SYSTEM TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  const createdBuyerIds: string[] = [];
  const results: TestResult[] = [];
  const performanceMetrics: number[] = [];

  try {
    console.log('PHASE 1: Creating Test Buyers & Validating Filters');
    console.log('─────────────────────────────────────────────────────────\n');

    for (const buyer of TEST_BUYERS) {
      console.log(`📝 ${buyer.city}, ${buyer.state} (${buyer.region})`);

      const { buyerId, generationTimeMs } = await createTestBuyer(
        buyer.city,
        buyer.state,
        buyer.maxMonthly,
        buyer.maxDown
      );

      createdBuyerIds.push(buyerId);
      performanceMetrics.push(generationTimeMs);

      console.log(`   ⏱️  Filter generated in ${generationTimeMs}ms`);

      // Validate filter
      const filterValidations = await validateFilter(buyerId, buyer.city, buyer.state);
      const criticalFailures = filterValidations.filter(
        v => !v.passed && v.severity === 'critical'
      );

      if (criticalFailures.length > 0) {
        console.log(`   ❌ CRITICAL: ${criticalFailures.map(v => v.details).join(', ')}`);
      } else {
        console.log(`   ✅ Filter validated`);
      }

      const profileDoc = await getDocs(
        query(collection(db, 'buyerProfiles'), where('id', '==', buyerId))
      );
      const profile = profileDoc.docs[0]?.data();

      results.push({
        buyer: {
          city: buyer.city,
          state: buyer.state,
          region: buyer.region,
          buyerId,
        },
        filter: {
          hasFilter: !!profile?.filter,
          nearbyCitiesCount: profile?.filter?.nearbyCitiesCount || 0,
          radiusMiles: profile?.filter?.radiusMiles || 0,
          hasGeohash: !!profile?.filter?.geohashPrefix,
          hasBoundingBox: !!profile?.filter?.boundingBox,
          generationTimeMs,
        },
        properties: {
          totalFound: 0,
          directMatches: 0,
          nearbyMatches: 0,
          propertyCities: [],
        },
        validations: filterValidations,
        success: criticalFailures.length === 0,
      });

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n\nPHASE 2: Testing Property Matching');
    console.log('─────────────────────────────────────────────────────────\n');

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`🔍 ${result.buyer.city}, ${result.buyer.state}`);

      const propertyResults = await testPropertyMatching(
        result.buyer.buyerId,
        result.buyer.city,
        result.buyer.state
      );

      result.properties = {
        totalFound: propertyResults.totalFound,
        directMatches: propertyResults.directMatches,
        nearbyMatches: propertyResults.nearbyMatches,
        propertyCities: propertyResults.propertyCities,
      };

      result.validations.push(...propertyResults.validations);

      console.log(`   🏠 ${propertyResults.directMatches} direct + ${propertyResults.nearbyMatches} nearby = ${propertyResults.totalFound} total`);

      if (propertyResults.propertyCities.length > 0) {
        console.log(`   📍 ${propertyResults.propertyCities.slice(0, 5).join(', ')}${propertyResults.propertyCities.length > 5 ? '...' : ''}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Generate comprehensive report
    console.log('\n\n📊 COMPREHENSIVE TEST REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const avgGenerationTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
    const maxGenerationTime = Math.max(...performanceMetrics);
    const avgNearbyCities = results.reduce((sum, r) => sum + r.filter.nearbyCitiesCount, 0) / results.length;

    console.log('🎯 Overall Results:');
    console.log(`   Tests passed: ${successfulTests}/${totalTests} (${((successfulTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`   Total properties found: ${results.reduce((sum, r) => sum + r.properties.totalFound, 0)}`);
    console.log(`   Avg properties per buyer: ${(results.reduce((sum, r) => sum + r.properties.totalFound, 0) / results.length).toFixed(1)}`);

    console.log('\n⚡ Performance Metrics:');
    console.log(`   Avg filter generation: ${avgGenerationTime.toFixed(1)}ms`);
    console.log(`   Max filter generation: ${maxGenerationTime.toFixed(1)}ms`);
    console.log(`   Avg nearby cities: ${avgNearbyCities.toFixed(1)}`);
    console.log(`   Performance target: <10ms ✅ ${avgGenerationTime < 10 ? 'MET' : 'NOT MET'}`);

    console.log('\n✅ Validation Summary:');
    const allValidations = results.flatMap(r => r.validations);
    const criticalTests = allValidations.filter(v => v.severity === 'critical');
    const criticalPassed = criticalTests.filter(v => v.passed).length;

    console.log(`   Critical validations: ${criticalPassed}/${criticalTests.length} passed`);
    console.log(`   All filters generated: ${results.every(r => r.filter.hasFilter) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   All have nearby cities: ${results.every(r => r.filter.nearbyCitiesCount > 0) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   All have bounding boxes: ${results.every(r => r.filter.hasBoundingBox) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   All have geohashes: ${results.every(r => r.filter.hasGeohash) ? '✅ PASS' : '⚠️  PARTIAL'}`);

    // Detailed failures
    const failedValidations = allValidations.filter(v => !v.passed && v.severity === 'critical');
    if (failedValidations.length > 0) {
      console.log('\n❌ Critical Failures:');
      failedValidations.forEach(v => {
        console.log(`   - ${v.test}: ${v.details}`);
      });
    }

    console.log('\n📋 Detailed Results:');
    console.log('─────────────────────────────────────────────────────────');

    results.forEach((r, idx) => {
      const status = r.success ? '✅' : '❌';
      console.log(`\n${idx + 1}. ${status} ${r.buyer.city}, ${r.buyer.state} (${r.buyer.region})`);
      console.log(`   Filter: ${r.filter.nearbyCitiesCount} cities, ${r.filter.generationTimeMs}ms`);
      console.log(`   Properties: ${r.properties.directMatches} + ${r.properties.nearbyMatches} = ${r.properties.totalFound}`);

      const warnings = r.validations.filter(v => !v.passed && v.severity === 'warning');
      if (warnings.length > 0) {
        console.log(`   ⚠️  Warnings: ${warnings.length}`);
      }
    });

    if (successfulTests === totalTests && criticalPassed === criticalTests.length) {
      console.log('\n\n🎉 ALL TESTS PASSED!');
      console.log('The pre-computed filter system is working correctly across all regions.');
    } else {
      console.log('\n\n⚠️  SOME TESTS FAILED');
      console.log('Review the failures above for details.');
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    const shouldCleanup = process.argv.includes('--cleanup');
    if (shouldCleanup) {
      await cleanupTestBuyers(createdBuyerIds);
    } else {
      console.log('\n💡 Test buyers remain in database.');
      console.log('   Run with --cleanup to remove them.');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
