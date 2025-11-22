import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { getCitiesWithinRadiusComprehensive } from '../src/lib/comprehensive-cities';
import { shouldUpdateFilter, getFilterStats } from '../src/lib/buyer-filter-service';

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

interface BuyerCheck {
  id: string;
  name: string;
  email: string;
  city: string;
  state: string;
  createdAt: Date;
  hasFilter: boolean;
  filterStatus: string;
  expectedCities: number;
  actualCities: number;
  isValid: boolean;
  issues: string[];
}

async function verifyLast10BuyersNearbyCities() {
  console.log('\n🔍 VERIFYING NEARBY CITY LOGIC FOR LAST 10 BUYERS');
  console.log('='.repeat(80));
  console.log('');

  // Get last 10 buyers sorted by creation date
  const buyersSnapshot = await db
    .collection('buyerProfiles')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log(`📊 Found ${buyersSnapshot.size} recent buyers\n`);

  const results: BuyerCheck[] = [];
  let allValid = true;

  for (const doc of buyersSnapshot.docs) {
    const buyer = doc.data();
    const issues: string[] = [];

    // Extract buyer info
    const searchCity = (buyer.preferredCity || buyer.city || '').trim();
    const searchState = (buyer.preferredState || buyer.state || '').trim();
    const buyerName = `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim();
    const createdAt = buyer.createdAt?.toDate() || new Date();

    console.log(`\n${'▸'.repeat(80)}`);
    console.log(`👤 ${buyerName || 'Unknown'}`);
    console.log(`📧 ${buyer.email || 'No email'}`);
    console.log(`📍 ${searchCity}, ${searchState}`);
    console.log(`📅 Signed up: ${createdAt.toLocaleDateString()}`);
    console.log(`${'▸'.repeat(80)}`);

    // Check if city/state exist
    if (!searchCity || !searchState) {
      issues.push('Missing city or state information');
      console.log('❌ Missing city or state');
      allValid = false;
    }

    // Calculate what the nearby cities SHOULD be
    let expectedNearbyCities: string[] = [];
    let expectedCount = 0;

    if (searchCity && searchState) {
      try {
        const nearbyCitiesData = getCitiesWithinRadiusComprehensive(
          searchCity,
          searchState,
          30
        );
        expectedNearbyCities = nearbyCitiesData.map(c => c.name);
        expectedCount = expectedNearbyCities.length;

        console.log(`\n📏 Expected nearby cities (30 mile radius): ${expectedCount}`);

        if (expectedCount === 0) {
          issues.push('No nearby cities found in comprehensive database');
          console.log('⚠️  WARNING: No cities found in comprehensive database');
        } else {
          console.log(`   Preview: ${expectedNearbyCities.slice(0, 5).join(', ')}${expectedCount > 5 ? '...' : ''}`);

          // Check if search city is included
          const includesSelf = expectedNearbyCities.some(
            c => c.toLowerCase() === searchCity.toLowerCase()
          );
          console.log(`   Includes "${searchCity}": ${includesSelf ? '✅' : '⚠️  No'}`);
        }
      } catch (error) {
        issues.push(`Error calculating nearby cities: ${error instanceof Error ? error.message : 'Unknown'}`);
        console.log(`❌ Error calculating nearby cities: ${error instanceof Error ? error.message : 'Unknown'}`);
        allValid = false;
      }
    }

    // Check stored filter
    const hasFilter = !!(buyer.filter && buyer.filter.nearbyCities);
    const actualCities = buyer.filter?.nearbyCities?.length || 0;

    console.log(`\n💾 Stored Filter:`);
    if (hasFilter) {
      console.log(`   ✅ Has filter with ${actualCities} cities`);
      console.log(`   ${getFilterStats(buyer.filter)}`);

      // Check if filter needs update
      const needsUpdate = shouldUpdateFilter(searchCity, searchState, buyer.filter);

      if (needsUpdate) {
        issues.push('Filter needs update (stale or city changed)');
        console.log(`   ⚠️  Filter needs update`);
        allValid = false;
      } else {
        console.log(`   ✅ Filter is up to date`);
      }

      // Compare expected vs actual
      if (expectedCount > 0 && Math.abs(expectedCount - actualCities) > 5) {
        issues.push(`Mismatch: expected ${expectedCount} cities, has ${actualCities}`);
        console.log(`   ⚠️  City count mismatch: expected ~${expectedCount}, has ${actualCities}`);
      }

      // Verify filter structure
      if (!buyer.filter.lastCityUpdate) {
        issues.push('Missing lastCityUpdate timestamp');
        console.log(`   ⚠️  Missing lastCityUpdate timestamp`);
      }

      if (!buyer.filter.radiusMiles) {
        issues.push('Missing radiusMiles');
        console.log(`   ⚠️  Missing radiusMiles`);
      }
    } else {
      issues.push('No filter configured');
      console.log(`   ❌ No filter configured - buyer won't see any properties!`);
      allValid = false;
    }

    // Overall validation
    const isValid = issues.length === 0;

    console.log(`\n📋 Validation Result: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
    if (issues.length > 0) {
      console.log(`   Issues found:`);
      issues.forEach(issue => console.log(`   • ${issue}`));
    }

    results.push({
      id: doc.id,
      name: buyerName,
      email: buyer.email,
      city: searchCity,
      state: searchState,
      createdAt,
      hasFilter,
      filterStatus: getFilterStats(buyer.filter),
      expectedCities: expectedCount,
      actualCities,
      isValid,
      issues
    });
  }

  // Summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;

  console.log(`\nTotal buyers checked: ${results.length}`);
  console.log(`✅ Valid: ${validCount}`);
  console.log(`❌ Invalid: ${invalidCount}`);

  if (invalidCount > 0) {
    console.log(`\n⚠️  ISSUES FOUND:`);
    results.forEach((result, index) => {
      if (!result.isValid) {
        console.log(`\n${index + 1}. ${result.name} (${result.email})`);
        console.log(`   Location: ${result.city}, ${result.state}`);
        result.issues.forEach(issue => console.log(`   • ${issue}`));
      }
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('💡 RECOMMENDATIONS:');
  console.log('='.repeat(80));

  if (allValid) {
    console.log('✅ All buyers have valid nearby city logic!');
    console.log('✅ No action needed.');
  } else {
    console.log('⚠️  Some buyers have issues with nearby city logic.');
    console.log('');
    console.log('Recommended actions:');
    console.log('1. For buyers missing filters: Run filter generation');
    console.log('2. For stale filters: Update filters with current logic');
    console.log('3. For city mismatches: Verify comprehensive cities database');
  }

  console.log('');
}

verifyLast10BuyersNearbyCities().catch(console.error);
