import { config } from 'dotenv';
import { getAdminDb } from '../src/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getCitiesWithinRadiusComprehensive } from '../src/lib/comprehensive-cities';
import { getNearbyCitiesUpdate } from '../src/lib/property-nearby-cities';

config({ path: '.env.local' });

/**
 * COMPREHENSIVE END-TO-END TEST
 * Tests the entire nearby cities flow from property creation to buyer search
 */
async function testFullFlow() {
  console.log('🔬 COMPREHENSIVE NEARBY CITIES SYSTEM TEST\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('   Testing Full Flow: Property → Storage → Search');
  console.log('═══════════════════════════════════════════════════\n');

  const db = await getAdminDb() as Firestore | null;
  if (!db) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }

  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  // ========================================
  // TEST 1: Property Nearby Cities Generation
  // ========================================
  console.log('📍 TEST 1: Property Nearby Cities Generation');
  console.log('─────────────────────────────────────────────────');
  totalTests++;

  try {
    const testProperty = {
      address: '123 Test Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701'
    };

    const updateData = await getNearbyCitiesUpdate(testProperty, 30);

    console.log(`✓ Generated nearby cities for ${testProperty.city}, ${testProperty.state}`);
    console.log(`✓ Source: ${updateData.nearbyCitiesSource}`);
    console.log(`✓ Cities found: ${(updateData.nearbyCities as any[]).length}`);
    console.log(`✓ Has timestamp: ${updateData.nearbyCitiesUpdatedAt ? 'YES' : 'NO'}`);

    if ((updateData.nearbyCities as any[]).length === 0) {
      console.log('❌ FAILED: No nearby cities found');
      failed++;
    } else {
      console.log('✅ PASSED\n');
      passed++;
    }
  } catch (error) {
    console.log(`❌ FAILED: ${(error as Error).message}\n`);
    failed++;
  }

  // ========================================
  // TEST 2: Storage Format Consistency
  // ========================================
  console.log('💾 TEST 2: Storage Format Consistency');
  console.log('─────────────────────────────────────────────────');
  totalTests++;

  try {
    const snapshot = await db.collection('properties')
      .where('nearbyCitiesSource', '!=', null)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('⚠️  SKIPPED: No properties with nearbyCitiesSource');
    } else {
      const data = snapshot.docs[0].data();
      const nc = data.nearbyCities;

      if (!Array.isArray(nc)) {
        console.log('❌ FAILED: nearbyCities is not an array');
        failed++;
      } else if (nc.length === 0) {
        console.log('⚠️  Property has empty nearbyCities array');
        passed++;
      } else {
        const first = nc[0];
        const hasName = typeof first === 'object' && 'name' in first;
        const hasState = typeof first === 'object' && 'state' in first;
        const hasDistance = typeof first === 'object' && 'distance' in first;

        console.log(`✓ Format check: ${hasName && hasState && hasDistance ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`✓ Has name: ${hasName}`);
        console.log(`✓ Has state: ${hasState}`);
        console.log(`✓ Has distance: ${hasDistance}`);

        if (hasName && hasState && hasDistance) {
          console.log('✅ PASSED\n');
          passed++;
        } else {
          console.log('❌ FAILED: Missing required fields\n');
          failed++;
        }
      }
    }
  } catch (error) {
    console.log(`❌ FAILED: ${(error as Error).message}\n`);
    failed++;
  }

  // ========================================
  // TEST 3: Buyer Search Logic
  // ========================================
  console.log('🔍 TEST 3: Buyer Search Logic');
  console.log('─────────────────────────────────────────────────');
  totalTests++;

  try {
    const buyerCity = 'Houston';
    const buyerState = 'TX';

    // Get nearby cities (what buyer search does)
    const nearbyCitiesList = getCitiesWithinRadiusComprehensive(buyerCity, buyerState, 30);
    const nearbyCityNames = new Set(nearbyCitiesList.map(c => c.name.toLowerCase()));

    console.log(`✓ Buyer searches: ${buyerCity}, ${buyerState}`);
    console.log(`✓ Found ${nearbyCityNames.size} nearby cities`);

    // Get all properties
    const allProps = await db.collection('properties').get();
    const properties = allProps.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Direct matches
    const directMatches = properties.filter((p: any) => {
      const propCity = p.city?.split(',')[0].trim();
      return propCity?.toLowerCase() === buyerCity.toLowerCase() &&
             p.state === buyerState &&
             p.isActive !== false;
    });

    // Nearby matches
    const nearbyMatches = properties.filter((p: any) => {
      const propCity = p.city?.split(',')[0].trim();
      if (propCity?.toLowerCase() === buyerCity.toLowerCase()) return false;
      if (p.state !== buyerState) return false;
      return propCity && nearbyCityNames.has(propCity.toLowerCase()) && p.isActive !== false;
    });

    console.log(`✓ Direct matches: ${directMatches.length}`);
    console.log(`✓ Nearby matches: ${nearbyMatches.length}`);
    console.log(`✓ Total results: ${directMatches.length + nearbyMatches.length}`);

    // Check for duplicates
    const allIds = [...directMatches, ...nearbyMatches].map((p: any) => p.id);
    const uniqueIds = new Set(allIds);

    if (allIds.length !== uniqueIds.size) {
      console.log(`❌ FAILED: Found ${allIds.length - uniqueIds.size} duplicate properties\n`);
      failed++;
    } else {
      console.log('✓ No duplicates found');
      console.log('✅ PASSED\n');
      passed++;
    }
  } catch (error) {
    console.log(`❌ FAILED: ${(error as Error).message}\n`);
    failed++;
  }

  // ========================================
  // TEST 4: Distance Calculation Accuracy
  // ========================================
  console.log('📏 TEST 4: Distance Calculation Accuracy');
  console.log('─────────────────────────────────────────────────');
  totalTests++;

  try {
    const cities = getCitiesWithinRadiusComprehensive('Memphis', 'TN', 30);
    const bartlett = cities.find(c => c.name.toLowerCase() === 'bartlett');

    if (!bartlett) {
      console.log('❌ FAILED: Bartlett not found in Memphis nearby cities');
      failed++;
    } else {
      const expectedDistance = 10.6; // Known distance
      const actualDistance = bartlett.distance;
      const variance = Math.abs(expectedDistance - actualDistance);

      console.log(`✓ Bartlett found: ${actualDistance.toFixed(1)} miles from Memphis`);
      console.log(`✓ Expected: ~${expectedDistance} miles`);
      console.log(`✓ Variance: ${variance.toFixed(1)} miles`);

      if (variance < 2) {
        console.log('✅ PASSED\n');
        passed++;
      } else {
        console.log('❌ FAILED: Distance calculation off by more than 2 miles\n');
        failed++;
      }
    }
  } catch (error) {
    console.log(`❌ FAILED: ${(error as Error).message}\n`);
    failed++;
  }

  // ========================================
  // TEST 5: Edge Cases
  // ========================================
  console.log('⚠️  TEST 5: Edge Cases');
  console.log('─────────────────────────────────────────────────');
  totalTests++;

  try {
    // Test city not in database
    const unknownCity = getCitiesWithinRadiusComprehensive('UnknownCityXYZ123', 'TX', 30);
    console.log(`✓ Unknown city returns: ${unknownCity.length} cities`);

    // Test empty state
    const emptyState = getCitiesWithinRadiusComprehensive('Houston', '', 30);
    console.log(`✓ Empty state returns: ${emptyState.length} cities`);

    // Test 0 radius
    const zeroRadius = getCitiesWithinRadiusComprehensive('Houston', 'TX', 0);
    console.log(`✓ Zero radius returns: ${zeroRadius.length} cities`);

    if (unknownCity.length === 0 && emptyState.length === 0) {
      console.log('✅ PASSED\n');
      passed++;
    } else {
      console.log('❌ FAILED: Edge cases not handled correctly\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED: ${(error as Error).message}\n`);
    failed++;
  }

  // ========================================
  // FINAL SUMMARY
  // ========================================
  console.log('═══════════════════════════════════════════════════');
  console.log('                  FINAL RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / totalTests) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════\n');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! System is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
  }

  process.exit(failed === 0 ? 0 : 1);
}

testFullFlow().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
