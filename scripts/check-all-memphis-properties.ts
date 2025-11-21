/**
 * Check all Memphis properties across all possible collections and statuses
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAllMemphisProperties() {
  console.log('🔍 Checking ALL Memphis properties across collections\n');
  console.log('='.repeat(60));

  // Check 'properties' collection
  console.log('\n📁 Collection: properties');
  const propertiesSnap = await getDocs(
    query(collection(db, 'properties'), where('city', '==', 'Memphis'))
  );
  console.log(`   Found ${propertiesSnap.size} Memphis properties`);

  if (propertiesSnap.size > 0) {
    const statusCounts: Record<string, number> = {};
    const isActiveCounts: Record<string, number> = { true: 0, false: 0, undefined: 0 };

    propertiesSnap.forEach((doc) => {
      const data = doc.data();
      const status = data.status || 'unknown';
      const isActive = data.isActive;

      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (isActive === true) isActiveCounts.true++;
      else if (isActive === false) isActiveCounts.false++;
      else isActiveCounts.undefined++;
    });

    console.log('\n   By status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    console.log('\n   By isActive flag:');
    console.log(`      true: ${isActiveCounts.true}`);
    console.log(`      false: ${isActiveCounts.false}`);
    console.log(`      undefined/null: ${isActiveCounts.undefined}`);

    console.log('\n   Sample properties:');
    propertiesSnap.docs.slice(0, 5).forEach((doc) => {
      const data = doc.data();
      console.log(`      ${data.address}, ${data.city}, ${data.state}`);
      console.log(`         Status: ${data.status || 'none'}, Active: ${data.isActive}, Price: $${data.listPrice}`);
      console.log(`         ID: ${doc.id}`);
    });
  }

  // Check what criteria buyers use
  console.log('\n\n🔎 Buyer Query Criteria:');
  console.log('   Looking for properties with:');
  console.log('   - status: "available"');
  console.log('   - isActive: true (or not false)');
  console.log('   - city matching buyer preferences');

  // Count properties that match buyer criteria
  const buyerCriteriaSnap = await getDocs(
    query(
      collection(db, 'properties'),
      where('city', '==', 'Memphis'),
      where('status', '==', 'available')
    )
  );
  console.log(`\n   Properties matching buyer criteria: ${buyerCriteriaSnap.size}`);

  if (buyerCriteriaSnap.size > 0) {
    console.log('   These are the properties buyers would see:');
    buyerCriteriaSnap.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`      ✅ ${data.address}, ${data.city}, ${data.state} - $${data.listPrice}`);
    });
  }

  // Also check with isActive filter
  const propertiesWithIsActive = await getDocs(
    query(collection(db, 'properties'), where('city', '==', 'Memphis'))
  );

  const activeProperties = propertiesWithIsActive.docs.filter((doc) => {
    const data = doc.data();
    return data.status === 'available' && data.isActive !== false;
  });

  console.log(`\n   Properties with status="available" AND isActive!=false: ${activeProperties.length}`);

  // Check zillow_imports collection (where buyers also see properties!)
  console.log('\n\n📁 Collection: zillow_imports');
  const zillowSnap = await getDocs(
    query(collection(db, 'zillow_imports'), where('city', '==', 'Memphis'))
  );
  console.log(`   Found ${zillowSnap.size} Memphis properties in zillow_imports`);

  if (zillowSnap.size > 0) {
    const statusCounts: Record<string, number> = {};
    const ownerFinanceVerified = { true: 0, false: 0, undefined: 0 };

    zillowSnap.forEach((doc) => {
      const data = doc.data();
      const status = data.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (data.ownerFinanceVerified === true) ownerFinanceVerified.true++;
      else if (data.ownerFinanceVerified === false) ownerFinanceVerified.false++;
      else ownerFinanceVerified.undefined++;
    });

    console.log('\n   By status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    console.log('\n   By ownerFinanceVerified:');
    console.log(`      true (shown to buyers): ${ownerFinanceVerified.true}`);
    console.log(`      false: ${ownerFinanceVerified.false}`);
    console.log(`      undefined: ${ownerFinanceVerified.undefined}`);

    console.log('\n   Sample zillow_imports properties:');
    zillowSnap.docs.slice(0, 5).forEach((doc) => {
      const data = doc.data();
      console.log(`      ${data.fullAddress || data.address}, ${data.city}, ${data.state}`);
      console.log(`         Status: ${data.status || 'none'}, Verified: ${data.ownerFinanceVerified}, Price: $${data.price || data.listPrice}`);
      console.log(`         ID: ${doc.id}`);
    });
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('🎯 SUMMARY - What Buyers See:');
  console.log('   Buyers see properties from TWO collections:');
  console.log(`   1. properties collection (isActive=true): ${activeProperties.length}`);
  console.log(`   2. zillow_imports (ownerFinanceVerified=true): ${ownerFinanceVerified.true}`);
  console.log(`\n   TOTAL properties buyers can see in Memphis: ${activeProperties.length + ownerFinanceVerified.true}`);
  console.log('='.repeat(60));
}

checkAllMemphisProperties().catch(console.error);
