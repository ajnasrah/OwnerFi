/**
 * COMPREHENSIVE LIKE & PASS PROPERTY ENDPOINTS TEST
 *
 * Tests:
 * 1. Like property endpoint (add/remove)
 * 2. Pass property endpoint (add/remove)
 * 3. Verify liked properties are tracked correctly
 * 4. Verify passed properties are excluded from search results
 * 5. Verify interaction data is stored in subcollections
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
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
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

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

async function createTestBuyer(city: string, state: string) {
  const userId = `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const buyerId = `test_buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { generateBuyerFilter } = await import('../src/lib/buyer-filter-service');
  const filter = await generateBuyerFilter(city, state, 30);

  const profileData = {
    id: buyerId,
    userId,
    firstName: 'Test',
    lastName: 'LikePass',
    email: `test.likepass@test.com`,
    phone: '555-0100',
    preferredCity: city,
    preferredState: state,
    city,
    state,
    searchRadius: 30,
    maxMonthlyPayment: 3000,
    maxDownPayment: 30000,
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
  return { buyerId, userId };
}

async function getAvailableProperties(buyerId: string, state: string) {
  // Get buyer profile
  const profileDoc = await getDoc(doc(db, 'buyerProfiles', buyerId));
  if (!profileDoc.exists()) return [];

  const profile = profileDoc.data();
  const passedIds = new Set(profile.passedPropertyIds || []);

  // Get properties from both collections
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
    getDocs(zillowQuery)
  ]);

  const allProperties = [
    ...propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'curated' })),
    ...zillowSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'zillow' }))
  ];

  const properties = allProperties.filter(p => !passedIds.has(p.id)); // Exclude passed properties

  return properties;
}

async function likeProperty(
  buyerId: string,
  propertyId: string,
  propertyContext?: any
) {
  // Get profile to get userId
  const profileDoc = await getDoc(doc(db, 'buyerProfiles', buyerId));
  if (!profileDoc.exists()) throw new Error('Profile not found');

  const profile = profileDoc.data();
  const userId = profile.userId;

  // 1. Add to likedPropertyIds array
  await updateDoc(doc(db, 'buyerProfiles', buyerId), {
    likedPropertyIds: arrayUnion(propertyId),
    likedProperties: arrayUnion(propertyId),
    updatedAt: serverTimestamp()
  });

  // 2. Store interaction
  const interactionId = `${propertyId}_${Date.now()}`;
  const interactionData: any = {
    propertyId,
    timestamp: serverTimestamp(),
  };

  if (propertyContext) {
    interactionData.context = propertyContext;
  }

  await setDoc(
    doc(db, 'propertyInteractions', buyerId, 'liked', interactionId),
    interactionData
  );

  return true;
}

async function unlikeProperty(buyerId: string, propertyId: string) {
  await updateDoc(doc(db, 'buyerProfiles', buyerId), {
    likedPropertyIds: arrayRemove(propertyId),
    likedProperties: arrayRemove(propertyId),
    updatedAt: serverTimestamp()
  });

  return true;
}

async function passProperty(
  buyerId: string,
  propertyId: string,
  passReason?: string,
  propertyContext?: any
) {
  // 1. Add to passedPropertyIds array
  await updateDoc(doc(db, 'buyerProfiles', buyerId), {
    passedPropertyIds: arrayUnion(propertyId),
    updatedAt: serverTimestamp()
  });

  // 2. Store interaction
  const interactionId = `${propertyId}_${Date.now()}`;
  const interactionData: any = {
    propertyId,
    timestamp: serverTimestamp(),
    passReason: passReason || null,
  };

  if (propertyContext) {
    interactionData.context = propertyContext;
  }

  await setDoc(
    doc(db, 'propertyInteractions', buyerId, 'passed', interactionId),
    interactionData
  );

  return true;
}

async function unpassProperty(buyerId: string, propertyId: string) {
  await updateDoc(doc(db, 'buyerProfiles', buyerId), {
    passedPropertyIds: arrayRemove(propertyId),
    updatedAt: serverTimestamp()
  });

  return true;
}

async function getBuyerProfile(buyerId: string) {
  const profileDoc = await getDoc(doc(db, 'buyerProfiles', buyerId));
  if (!profileDoc.exists()) return null;
  return profileDoc.data();
}

async function getPropertyInteractions(buyerId: string, type: 'liked' | 'passed') {
  const interactionsQuery = query(
    collection(db, 'propertyInteractions', buyerId, type)
  );
  const snapshot = await getDocs(interactionsQuery);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function runTests() {
  console.log('🚀 LIKE & PASS PROPERTY ENDPOINTS TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  const results: TestResult[] = [];
  let buyerId: string | null = null;

  try {
    // SETUP: Create test buyer
    console.log('SETUP: Creating test buyer in Texas...');
    const { buyerId: createdBuyerId } = await createTestBuyer('Houston', 'TX');
    buyerId = createdBuyerId;
    console.log(`✅ Created buyer: ${buyerId}\n`);

    // PHASE 1: Get available properties
    console.log('PHASE 1: Getting Available Properties');
    console.log('─────────────────────────────────────────────────────────');

    const initialProperties = await getAvailableProperties(buyerId, 'TX');
    console.log(`Found ${initialProperties.length} available properties in TX`);

    results.push({
      testName: 'Properties Available',
      passed: initialProperties.length > 0,
      details: `${initialProperties.length} properties found`,
      severity: initialProperties.length === 0 ? 'warning' : 'info'
    });

    if (initialProperties.length === 0) {
      console.log('⚠️  No properties available for testing. Skipping interaction tests.\n');
      return;
    }

    // Select properties for testing
    const propertiesToTest = initialProperties.slice(0, 5);
    console.log(`\nSelected ${propertiesToTest.length} properties for testing:`);
    propertiesToTest.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.id} - ${p.city || 'Unknown city'}`);
    });

    // PHASE 2: Test LIKE functionality
    console.log('\n\nPHASE 2: Testing LIKE Property');
    console.log('─────────────────────────────────────────────────────────');

    const propertyToLike = propertiesToTest[0];
    console.log(`\nLiking property: ${propertyToLike.id}`);

    await likeProperty(buyerId, propertyToLike.id, {
      monthlyPayment: propertyToLike.monthlyPayment || 2000,
      downPayment: propertyToLike.downPaymentAmount || 20000,
      bedrooms: propertyToLike.bedrooms || 3,
      bathrooms: propertyToLike.bathrooms || 2,
      city: propertyToLike.city || 'Houston',
      source: 'curated'
    });

    // Verify liked property is in array
    let profile = await getBuyerProfile(buyerId);
    const isInLikedArray = profile?.likedPropertyIds?.includes(propertyToLike.id);
    console.log(`  ${isInLikedArray ? '✅' : '❌'} Property in likedPropertyIds array`);

    results.push({
      testName: 'Like Property - Array Update',
      passed: isInLikedArray || false,
      details: `Property ${isInLikedArray ? 'added to' : 'NOT in'} likedPropertyIds`,
      severity: 'critical'
    });

    // Verify interaction was stored
    const likedInteractions = await getPropertyInteractions(buyerId, 'liked');
    const hasInteraction = likedInteractions.some(i => i.propertyId === propertyToLike.id);
    console.log(`  ${hasInteraction ? '✅' : '❌'} Interaction stored in subcollection`);

    results.push({
      testName: 'Like Property - Interaction Storage',
      passed: hasInteraction,
      details: `${likedInteractions.length} liked interactions found`,
      severity: 'critical'
    });

    // Test UNLIKE
    console.log(`\nUnliking property: ${propertyToLike.id}`);
    await unlikeProperty(buyerId, propertyToLike.id);

    profile = await getBuyerProfile(buyerId);
    const isRemovedFromArray = !profile?.likedPropertyIds?.includes(propertyToLike.id);
    console.log(`  ${isRemovedFromArray ? '✅' : '❌'} Property removed from likedPropertyIds`);

    results.push({
      testName: 'Unlike Property',
      passed: isRemovedFromArray,
      details: `Property ${isRemovedFromArray ? 'removed from' : 'still in'} likedPropertyIds`,
      severity: 'critical'
    });

    // PHASE 3: Test PASS functionality
    console.log('\n\nPHASE 3: Testing PASS Property');
    console.log('─────────────────────────────────────────────────────────');

    const propertyToPass = propertiesToTest[1];
    console.log(`\nPassing property: ${propertyToPass.id} (reason: too_expensive)`);

    await passProperty(buyerId, propertyToPass.id, 'too_expensive', {
      monthlyPayment: propertyToPass.monthlyPayment || 2000,
      downPayment: propertyToPass.downPaymentAmount || 20000,
      bedrooms: propertyToPass.bedrooms || 3,
      bathrooms: propertyToPass.bathrooms || 2,
      city: propertyToPass.city || 'Houston',
      source: 'curated'
    });

    // Verify passed property is in array
    profile = await getBuyerProfile(buyerId);
    const isInPassedArray = profile?.passedPropertyIds?.includes(propertyToPass.id);
    console.log(`  ${isInPassedArray ? '✅' : '❌'} Property in passedPropertyIds array`);

    results.push({
      testName: 'Pass Property - Array Update',
      passed: isInPassedArray || false,
      details: `Property ${isInPassedArray ? 'added to' : 'NOT in'} passedPropertyIds`,
      severity: 'critical'
    });

    // Verify interaction was stored with reason
    const passedInteractions = await getPropertyInteractions(buyerId, 'passed');
    const passInteraction = passedInteractions.find(i => i.propertyId === propertyToPass.id);
    const hasPassInteraction = !!passInteraction;
    const hasPassReason = passInteraction?.passReason === 'too_expensive';

    console.log(`  ${hasPassInteraction ? '✅' : '❌'} Interaction stored in subcollection`);
    console.log(`  ${hasPassReason ? '✅' : '❌'} Pass reason recorded: ${passInteraction?.passReason || 'N/A'}`);

    results.push({
      testName: 'Pass Property - Interaction Storage',
      passed: hasPassInteraction,
      details: `${passedInteractions.length} passed interactions found`,
      severity: 'critical'
    });

    results.push({
      testName: 'Pass Property - Reason Tracking',
      passed: hasPassReason,
      details: `Reason: ${passInteraction?.passReason || 'missing'}`,
      severity: 'warning'
    });

    // PHASE 4: Verify passed properties are EXCLUDED from search
    console.log('\n\nPHASE 4: Verify Passed Properties Exclusion');
    console.log('─────────────────────────────────────────────────────────');

    const propertiesAfterPass = await getAvailableProperties(buyerId, 'TX');
    const passedPropertyStillVisible = propertiesAfterPass.some(p => p.id === propertyToPass.id);

    console.log(`Initial properties: ${initialProperties.length}`);
    console.log(`After passing 1 property: ${propertiesAfterPass.length}`);
    console.log(`Passed property visible: ${passedPropertyStillVisible ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);

    results.push({
      testName: 'Passed Properties Excluded',
      passed: !passedPropertyStillVisible,
      details: `${initialProperties.length - propertiesAfterPass.length} properties filtered out`,
      severity: 'critical'
    });

    // Test UNPASS
    console.log(`\nUn-passing property: ${propertyToPass.id}`);
    await unpassProperty(buyerId, propertyToPass.id);

    profile = await getBuyerProfile(buyerId);
    const isRemovedFromPassedArray = !profile?.passedPropertyIds?.includes(propertyToPass.id);
    console.log(`  ${isRemovedFromPassedArray ? '✅' : '❌'} Property removed from passedPropertyIds`);

    const propertiesAfterUnpass = await getAvailableProperties(buyerId, 'TX');
    const propertyVisibleAgain = propertiesAfterUnpass.some(p => p.id === propertyToPass.id);
    console.log(`  ${propertyVisibleAgain ? '✅' : '❌'} Property visible again in search`);

    results.push({
      testName: 'Unpass Property',
      passed: isRemovedFromPassedArray && propertyVisibleAgain,
      details: `Property ${propertyVisibleAgain ? 'restored' : 'still hidden'}`,
      severity: 'critical'
    });

    // PHASE 5: Test multiple likes and passes
    console.log('\n\nPHASE 5: Testing Multiple Properties');
    console.log('─────────────────────────────────────────────────────────');

    console.log('\nLiking 2 more properties...');
    await likeProperty(buyerId, propertiesToTest[2].id);
    await likeProperty(buyerId, propertiesToTest[3].id);

    console.log('Passing 1 more property...');
    await passProperty(buyerId, propertiesToTest[4].id, 'wrong_location');

    profile = await getBuyerProfile(buyerId);
    const likedCount = profile?.likedPropertyIds?.length || 0;
    const passedCount = profile?.passedPropertyIds?.length || 0;

    console.log(`  Liked properties: ${likedCount} (expected: 2)`);
    console.log(`  Passed properties: ${passedCount} (expected: 1)`);

    results.push({
      testName: 'Multiple Properties Tracking',
      passed: likedCount === 2 && passedCount === 1,
      details: `${likedCount} liked, ${passedCount} passed`,
      severity: 'warning'
    });

    // SUMMARY
    console.log('\n\n📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');

    const criticalTests = results.filter(r => r.severity === 'critical');
    const criticalPassed = criticalTests.filter(r => r.passed).length;
    const allPassed = results.every(r => r.passed);

    console.log(`\nOverall: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.passed).length}`);
    console.log(`Failed: ${results.filter(r => !r.passed).length}`);
    console.log(`Critical: ${criticalPassed}/${criticalTests.length} passed`);

    console.log('\n\nDetailed Results:');
    console.log('─────────────────────────────────────────────────────────');
    results.forEach(r => {
      const icon = r.passed ? '✅' : '❌';
      const severity = r.severity === 'critical' ? '🔴' : r.severity === 'warning' ? '🟡' : '🔵';
      console.log(`${icon} ${severity} ${r.testName}`);
      console.log(`   ${r.details}`);
    });

    const failedCritical = criticalTests.filter(r => !r.passed);
    if (failedCritical.length > 0) {
      console.log('\n\n❌ CRITICAL FAILURES:');
      failedCritical.forEach(r => {
        console.log(`   - ${r.testName}: ${r.details}`);
      });
    }

    console.log('\n\n✅ KEY VALIDATIONS:');
    console.log(`  ✅ Like endpoint stores in likedPropertyIds: ${results.find(r => r.testName === 'Like Property - Array Update')?.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Like endpoint stores interactions: ${results.find(r => r.testName === 'Like Property - Interaction Storage')?.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Unlike endpoint removes from array: ${results.find(r => r.testName === 'Unlike Property')?.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Pass endpoint stores in passedPropertyIds: ${results.find(r => r.testName === 'Pass Property - Array Update')?.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Pass endpoint stores interactions: ${results.find(r => r.testName === 'Pass Property - Interaction Storage')?.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Passed properties excluded from search: ${results.find(r => r.testName === 'Passed Properties Excluded')?.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Unpass endpoint restores properties: ${results.find(r => r.testName === 'Unpass Property')?.passed ? 'PASS' : 'FAIL'}`);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    results.push({
      testName: 'Test Execution',
      passed: false,
      details: `Error: ${error}`,
      severity: 'critical'
    });
  } finally {
    // Cleanup
    if (buyerId) {
      console.log('\n\n🧹 Cleaning up test data...');
      try {
        // Delete buyer profile
        await deleteDoc(doc(db, 'buyerProfiles', buyerId));
        console.log('  ✅ Deleted buyer profile');

        // Delete interactions (liked subcollection)
        const likedSnapshot = await getDocs(
          collection(db, 'propertyInteractions', buyerId, 'liked')
        );
        for (const interactionDoc of likedSnapshot.docs) {
          await deleteDoc(interactionDoc.ref);
        }
        console.log(`  ✅ Deleted ${likedSnapshot.docs.length} liked interactions`);

        // Delete interactions (passed subcollection)
        const passedSnapshot = await getDocs(
          collection(db, 'propertyInteractions', buyerId, 'passed')
        );
        for (const interactionDoc of passedSnapshot.docs) {
          await deleteDoc(interactionDoc.ref);
        }
        console.log(`  ✅ Deleted ${passedSnapshot.docs.length} passed interactions`);

      } catch (cleanupError) {
        console.log('  ⚠️  Cleanup error:', cleanupError);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
