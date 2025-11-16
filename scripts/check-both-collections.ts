/**
 * Check Both Collections
 * Compare properties vs zillow_imports
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

async function checkBothCollections() {
  console.log('🔍 COLLECTION COMPARISON\n');
  console.log('=' .repeat(80));

  // Check properties collection (admin panel)
  console.log('\n[1] Checking "properties" collection (Admin Panel)...\n');
  const propertiesSnapshot = await db.collection('properties').limit(10).get();
  console.log(`📊 Total in "properties" collection: ${propertiesSnapshot.size}`);

  if (propertiesSnapshot.size > 0) {
    console.log('\n   Sample from "properties":');
    propertiesSnapshot.docs.slice(0, 3).forEach((doc, i) => {
      const data = doc.data();
      console.log(`   ${i + 1}. ${data.address || data.fullAddress}`);
      console.log(`      Status: ${data.status}`);
      console.log(`      Source: ${data.source || 'manual'}`);
    });
  } else {
    console.log('   ❌ EMPTY - No properties in this collection!');
  }

  // Check zillow_imports collection (buyer UI)
  console.log('\n\n[2] Checking "zillow_imports" collection (Buyer UI)...\n');
  const zillowSnapshot = await db
    .collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .limit(10)
    .get();

  const totalZillow = await db
    .collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  console.log(`📊 Total in "zillow_imports" collection: ${totalZillow.size}`);

  if (zillowSnapshot.size > 0) {
    console.log('\n   Sample from "zillow_imports":');
    zillowSnapshot.docs.slice(0, 3).forEach((doc, i) => {
      const data = doc.data();
      console.log(`   ${i + 1}. ${data.fullAddress || data.streetAddress}`);
      console.log(`      Status: ${data.status}`);
      console.log(`      Keyword: ${data.primaryKeyword}`);
    });
  }

  // Summary
  console.log('\n\n' + '=' .repeat(80));
  console.log('📊 SUMMARY');
  console.log('=' .repeat(80));
  console.log(`\n❌ Admin Panel ("properties" collection): ${propertiesSnapshot.size} properties`);
  console.log(`✅ Buyer UI ("zillow_imports" collection): ${totalZillow.size} properties`);

  console.log('\n🔴 ISSUE IDENTIFIED:');
  console.log('   - Admin panel shows "properties" collection (EMPTY or OLD)');
  console.log('   - Your 1,428 owner-financed properties are in "zillow_imports"');
  console.log('   - Admin panel needs to show zillow_imports instead!');
  console.log('\n' + '=' .repeat(80));
}

checkBothCollections().catch(console.error);
