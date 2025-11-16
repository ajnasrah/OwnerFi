/**
 * Check how many properties are currently showing in buyer preview
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function checkBuyerPreview() {
  console.log('🔍 Checking Buyer Preview Property Count\n');
  console.log('=' .repeat(80));

  try {
    // Query 1: Curated properties (existing system)
    console.log('\n📊 Querying curated properties (properties collection)...');
    const propertiesSnapshot = await db
      .collection('properties')
      .where('isActive', '==', true)
      .get();

    const curatedCount = propertiesSnapshot.size;
    console.log(`✅ Found ${curatedCount} active curated properties`);

    // Show sample
    if (curatedCount > 0) {
      const sample = propertiesSnapshot.docs[0].data();
      console.log(`   Sample: ${sample.address || sample.fullAddress || 'N/A'}`);
    }

    // Query 2: Zillow properties (NEW system)
    console.log('\n📊 Querying Zillow properties (zillow_imports collection)...');

    // Check total zillow_imports
    const allZillowSnapshot = await db
      .collection('zillow_imports')
      .get();

    console.log(`   Total in zillow_imports: ${allZillowSnapshot.size}`);

    // Check how many would show to buyers (status = found or verified)
    const zillowBuyerSnapshot = await db
      .collection('zillow_imports')
      .where('status', 'in', ['found', 'verified'])
      .get();

    const zillowCount = zillowBuyerSnapshot.size;
    console.log(`✅ Found ${zillowCount} Zillow properties for buyers (status: found/verified)`);

    // Show sample
    if (zillowCount > 0) {
      const sample = zillowBuyerSnapshot.docs[0].data();
      console.log(`   Sample: ${sample.fullAddress || 'N/A'}`);
      console.log(`   Status: ${sample.status}`);
      console.log(`   Keyword: ${sample.primaryKeyword || sample.matchedKeywords?.[0] || 'N/A'}`);
    }

    // Break down by status
    const foundCount = zillowBuyerSnapshot.docs.filter(doc => doc.data().status === 'found').length;
    const verifiedCount = zillowBuyerSnapshot.docs.filter(doc => doc.data().status === 'verified').length;

    console.log(`\n   Breakdown:`);
    console.log(`   - 🟡 Found (awaiting terms): ${foundCount}`);
    console.log(`   - 🟢 Agent Response (has terms): ${verifiedCount}`);

    // Total for buyers
    const totalForBuyers = curatedCount + zillowCount;

    console.log('\n' + '=' .repeat(80));
    console.log('📊 BUYER PREVIEW TOTALS');
    console.log('=' .repeat(80));
    console.log(`Curated Properties:  ${curatedCount.toLocaleString()}`);
    console.log(`Zillow Properties:   ${zillowCount.toLocaleString()}`);
    console.log('─'.repeat(80));
    console.log(`TOTAL FOR BUYERS:    ${totalForBuyers.toLocaleString()} properties`);
    console.log('=' .repeat(80));

    // Additional stats
    console.log('\n📈 ADDITIONAL STATS:');

    // Check how many have owner finance keywords
    const withKeywords = zillowBuyerSnapshot.docs.filter(doc =>
      doc.data().primaryKeyword || doc.data().matchedKeywords?.length > 0
    ).length;

    console.log(`Properties with owner finance keywords: ${withKeywords}/${zillowCount}`);

    // Check how many sent to GHL
    const sentToGHL = zillowBuyerSnapshot.docs.filter(doc => doc.data().sentToGHL === true).length;
    console.log(`Properties sent to GHL: ${sentToGHL}/${zillowCount}`);

    // Check by state (top 5)
    const stateCount: Record<string, number> = {};
    zillowBuyerSnapshot.docs.forEach(doc => {
      const state = doc.data().state;
      if (state) {
        stateCount[state] = (stateCount[state] || 0) + 1;
      }
    });

    const topStates = Object.entries(stateCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log('\nTop 5 States:');
    topStates.forEach(([state, count]) => {
      console.log(`  ${state}: ${count} properties`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkBuyerPreview().catch(console.error);
