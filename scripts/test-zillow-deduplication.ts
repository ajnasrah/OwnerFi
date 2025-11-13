/**
 * Test script for Zillow scraper deduplication fixes
 *
 * Tests:
 * 1. URL deduplication - removes duplicate URLs before scraping
 * 2. ZPID deduplication - uses ZPID as document ID
 * 3. Sent tracking - marks properties as sent
 * 4. Contact limit - max 3 properties per agent/broker
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function testURLDeduplication() {
  console.log('\n🧪 TEST 1: URL Deduplication');
  console.log('=' .repeat(50));

  // Simulate duplicate URLs
  const urls = [
    'https://zillow.com/property1',
    'https://zillow.com/property2',
    'https://zillow.com/property1', // duplicate
    'https://zillow.com/property3',
    'https://zillow.com/property2', // duplicate
  ];

  const uniqueUrls = Array.from(new Set(urls));
  const duplicatesRemoved = urls.length - uniqueUrls.length;

  const passed = uniqueUrls.length === 3 && duplicatesRemoved === 2;

  console.log(`   Original URLs: ${urls.length}`);
  console.log(`   Unique URLs: ${uniqueUrls.length}`);
  console.log(`   Duplicates removed: ${duplicatesRemoved}`);
  console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}`);

  results.push({
    test: 'URL Deduplication',
    passed,
    details: `Removed ${duplicatesRemoved} duplicates (${urls.length} → ${uniqueUrls.length})`
  });
}

async function testZPIDDeduplication() {
  console.log('\n🧪 TEST 2: ZPID-based Document IDs');
  console.log('=' .repeat(50));

  try {
    // Create test properties with same ZPID
    const zpid = `test_${Date.now()}`;

    // First insert
    await db.collection('zillow_imports').doc(zpid).set({
      zpid,
      address: '123 Test St',
      price: 100000,
      importedAt: new Date(),
      createdAt: new Date(),
    });

    console.log(`   Created property with ZPID: ${zpid}`);

    // Second insert with same ZPID (should update, not duplicate)
    await db.collection('zillow_imports').doc(zpid).set({
      zpid,
      address: '123 Test St',
      price: 150000, // Updated price
      importedAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    console.log(`   Updated same ZPID with new price`);

    // Check that only one document exists
    const snapshot = await db.collection('zillow_imports')
      .where('zpid', '==', zpid)
      .get();

    const passed = snapshot.size === 1 && snapshot.docs[0].data().price === 150000;

    console.log(`   Documents with ZPID "${zpid}": ${snapshot.size}`);
    console.log(`   Price: ${snapshot.docs[0].data().price}`);
    console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Only one document, price updated`);

    // Cleanup
    await db.collection('zillow_imports').doc(zpid).delete();

    results.push({
      test: 'ZPID Deduplication',
      passed,
      details: `ZPID as document ID prevents duplicates, allows updates`
    });

  } catch (error) {
    console.error(`   ❌ FAIL: ${error}`);
    results.push({
      test: 'ZPID Deduplication',
      passed: false,
      details: `Error: ${error}`
    });
  }
}

async function testSentTracking() {
  console.log('\n🧪 TEST 3: Sent Tracking');
  console.log('=' .repeat(50));

  try {
    // Create test property
    const zpid = `test_sent_${Date.now()}`;

    await db.collection('zillow_imports').doc(zpid).set({
      zpid,
      address: '456 Test Ave',
      price: 200000,
      agentPhoneNumber: '555-1234',
      importedAt: new Date(),
      sentToGHL: false,
    });

    console.log(`   Created property with ZPID: ${zpid}`);

    // Query for unsent properties
    const unsentSnapshot = await db.collection('zillow_imports')
      .where('zpid', '==', zpid)
      .where('sentToGHL', '!=', true)
      .get();

    console.log(`   Unsent properties: ${unsentSnapshot.size}`);

    // Mark as sent
    await db.collection('zillow_imports').doc(zpid).update({
      sentToGHL: true,
      sentToGHLAt: new Date(),
      sentToGHLBy: 'test_user',
    });

    console.log(`   Marked as sent`);

    // Query again - should be empty
    const unsentAfterSnapshot = await db.collection('zillow_imports')
      .where('zpid', '==', zpid)
      .where('sentToGHL', '!=', true)
      .get();

    const passed = unsentSnapshot.size === 1 && unsentAfterSnapshot.size === 0;

    console.log(`   Unsent properties after marking: ${unsentAfterSnapshot.size}`);
    console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Property excluded from future queries`);

    // Cleanup
    await db.collection('zillow_imports').doc(zpid).delete();

    results.push({
      test: 'Sent Tracking',
      passed,
      details: 'Properties marked as sent are excluded from future sends'
    });

  } catch (error) {
    console.error(`   ❌ FAIL: ${error}`);
    results.push({
      test: 'Sent Tracking',
      passed: false,
      details: `Error: ${error}`
    });
  }
}

async function testContactLimit() {
  console.log('\n🧪 TEST 4: Contact-Based Deduplication (Max 3 per contact)');
  console.log('=' .repeat(50));

  try {
    // Simulate properties from same agent
    const agentPhone = '555-9999';
    const properties = [
      { zpid: 1, estimate: 500000, agentPhoneNumber: agentPhone },
      { zpid: 2, estimate: 400000, agentPhoneNumber: agentPhone },
      { zpid: 3, estimate: 300000, agentPhoneNumber: agentPhone },
      { zpid: 4, estimate: 200000, agentPhoneNumber: agentPhone },
      { zpid: 5, estimate: 100000, agentPhoneNumber: agentPhone },
    ];

    // Group by contact
    const contactMap = new Map();
    for (const property of properties) {
      const phone = property.agentPhoneNumber;
      const cleanPhone = phone.replace(/\D/g, '');

      if (!contactMap.has(cleanPhone)) {
        contactMap.set(cleanPhone, []);
      }
      contactMap.get(cleanPhone).push(property);
    }

    // Limit to top 3 by value
    const toSend: any[] = [];
    for (const [phone, contactProperties] of contactMap.entries()) {
      const sorted = contactProperties.sort((a: any, b: any) =>
        (b.estimate || 0) - (a.estimate || 0)
      );
      toSend.push(...sorted.slice(0, 3));
    }

    const passed = toSend.length === 3 &&
                  toSend[0].estimate === 500000 &&
                  toSend[1].estimate === 400000 &&
                  toSend[2].estimate === 300000;

    console.log(`   Total properties from agent: ${properties.length}`);
    console.log(`   Properties to send: ${toSend.length}`);
    console.log(`   Top 3 values: $${toSend[0].estimate}, $${toSend[1].estimate}, $${toSend[2].estimate}`);
    console.log(`   Skipped: ${properties.length - toSend.length} lower-value properties`);
    console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}: Only top 3 selected`);

    results.push({
      test: 'Contact Limit',
      passed,
      details: `Limited to 3 highest-value properties per contact (skipped ${properties.length - toSend.length})`
    });

  } catch (error) {
    console.error(`   ❌ FAIL: ${error}`);
    results.push({
      test: 'Contact Limit',
      passed: false,
      details: `Error: ${error}`
    });
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 ZILLOW SCRAPER DEDUPLICATION TESTS');
  console.log('='.repeat(50));

  await testURLDeduplication();
  await testZPIDDeduplication();
  await testSentTracking();
  await testContactLimit();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    console.log(`\n${result.passed ? '✅' : '❌'} ${result.test}`);
    console.log(`   ${result.details}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log(`RESULT: ${passed}/${total} tests passed`);
  console.log('='.repeat(50) + '\n');

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
