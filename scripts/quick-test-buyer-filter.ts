/**
 * QUICK BUYER FILTER TEST
 *
 * Fast test for a single buyer to verify the filter system works.
 * Useful for development and debugging.
 *
 * Usage:
 *   npx tsx scripts/quick-test-buyer-filter.ts "Houston" "TX"
 *   npx tsx scripts/quick-test-buyer-filter.ts "Phoenix" "AZ" --cleanup
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

async function quickTest() {
  // Get city and state from command line args
  const city = process.argv[2] || 'Houston';
  const state = process.argv[3] || 'TX';
  const shouldCleanup = process.argv.includes('--cleanup');

  console.log(`\n🧪 QUICK BUYER FILTER TEST: ${city}, ${state}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const buyerId = `quick_test_${Date.now()}`;

  try {
    // 1. Generate filter
    console.log('📝 Step 1: Generating pre-computed filter...');
    const { generateBuyerFilter } = await import('../src/lib/buyer-filter-service');
    const startTime = Date.now();
    const filter = await generateBuyerFilter(city, state, 30);
    const generationTime = Date.now() - startTime;

    console.log(`   ✅ Generated in ${generationTime}ms`);
    console.log(`   📍 ${filter.nearbyCitiesCount} nearby cities found`);
    console.log(`   🗺️  Radius: ${filter.radiusMiles} miles`);
    console.log(`   🔧 Geohash: ${filter.geohashPrefix || 'N/A'}`);

    // Show sample nearby cities
    const sampleCities = filter.nearbyCities.slice(0, 10);
    console.log(`   \n   Sample nearby cities:`);
    sampleCities.forEach((c, i) => {
      console.log(`     ${i + 1}. ${c}`);
    });
    if (filter.nearbyCities.length > 10) {
      console.log(`     ... and ${filter.nearbyCities.length - 10} more`);
    }

    // 2. Create buyer profile
    console.log('\n📝 Step 2: Creating buyer profile...');
    const profileData = {
      id: buyerId,
      userId: `user_${buyerId}`,
      firstName: 'Quick',
      lastName: 'Test',
      email: `quicktest@test.com`,
      phone: '555-0100',
      preferredCity: city,
      preferredState: state,
      city,
      state,
      searchRadius: 30,
      maxMonthlyPayment: 2000,
      maxDownPayment: 20000,
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
    console.log(`   ✅ Profile created: ${buyerId}`);

    // 3. Query properties
    console.log('\n📝 Step 3: Querying matching properties...');

    const nearbyCityNames = new Set(filter.nearbyCities.map(c => c.toLowerCase()));

    // Query both collections
    const propertiesQuery = query(
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
      getDocs(propertiesQuery),
      getDocs(zillowQuery),
    ]);

    const allProperties = [
      ...propertiesSnapshot.docs.map(d => ({ id: d.id, ...d.data(), source: 'curated' })),
      ...zillowSnapshot.docs.map(d => ({ id: d.id, ...d.data(), source: 'zillow' })),
    ];

    // Categorize
    const directMatches = allProperties.filter(p => {
      const propCity = p.city?.split(',')[0].trim().toLowerCase();
      return propCity === city.toLowerCase();
    });

    const nearbyMatches = allProperties.filter(p => {
      const propCity = p.city?.split(',')[0].trim().toLowerCase();
      return propCity !== city.toLowerCase() && nearbyCityNames.has(propCity);
    });

    console.log(`   ✅ Found ${allProperties.length} total properties in ${state}`);
    console.log(`   📍 ${directMatches.length} direct matches (in ${city})`);
    console.log(`   📍 ${nearbyMatches.length} nearby matches`);

    // Show sample properties
    if (directMatches.length > 0) {
      console.log(`\n   Direct properties in ${city}:`);
      directMatches.slice(0, 3).forEach(p => {
        console.log(`     • ${p.address || p.streetAddress || 'Address N/A'} - $${p.monthlyPayment || 'TBD'}/mo`);
      });
    }

    if (nearbyMatches.length > 0) {
      console.log(`\n   Nearby properties:`);
      const citySample = new Map<string, number>();
      nearbyMatches.forEach(p => {
        const propCity = p.city?.split(',')[0].trim();
        if (propCity) {
          citySample.set(propCity, (citySample.get(propCity) || 0) + 1);
        }
      });

      Array.from(citySample.entries()).slice(0, 5).forEach(([city, count]) => {
        console.log(`     • ${city}: ${count} properties`);
      });

      if (citySample.size > 5) {
        console.log(`     ... and ${citySample.size - 5} more cities`);
      }
    }

    // 4. Validation summary
    console.log('\n📝 Step 4: Validation Summary...');
    const validations = [
      { test: 'Filter generated', pass: !!filter },
      { test: 'Nearby cities found', pass: filter.nearbyCities.length > 0 },
      { test: 'Search city included', pass: nearbyCityNames.has(city.toLowerCase()) },
      { test: 'Bounding box present', pass: !!filter.boundingBox },
      { test: 'Properties found', pass: allProperties.length > 0 },
      { test: 'Nearby matches work', pass: nearbyMatches.length > 0 || directMatches.length > 0 },
    ];

    validations.forEach(v => {
      const status = v.pass ? '✅' : '❌';
      console.log(`   ${status} ${v.test}`);
    });

    const allPassed = validations.every(v => v.pass);

    console.log('\n═══════════════════════════════════════════════════════════');
    if (allPassed) {
      console.log('🎉 SUCCESS: Filter system working correctly!\n');
    } else {
      console.log('⚠️  WARNING: Some validations failed. Review above.\n');
    }

    // Cleanup
    if (shouldCleanup) {
      console.log('🧹 Cleaning up test buyer...');
      await deleteDoc(doc(db, 'buyerProfiles', buyerId));
      console.log('   ✅ Test buyer deleted\n');
    } else {
      console.log(`💡 Test buyer remains in database (ID: ${buyerId})`);
      console.log(`   Run with --cleanup to remove it.\n`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.log('\nTrying to cleanup...');
    try {
      await deleteDoc(doc(db, 'buyerProfiles', buyerId));
      console.log('✅ Cleaned up test buyer\n');
    } catch (cleanupError) {
      console.log('⚠️  Could not cleanup test buyer\n');
    }
  }
}

quickTest().catch(console.error);
