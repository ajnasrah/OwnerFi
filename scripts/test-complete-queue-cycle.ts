/**
 * Complete test of property queue lifecycle:
 * 1. Add property -> verify auto-add
 * 2. Delete property -> verify stays in queue
 * 3. Run sync cron -> verify auto-delete
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

async function testCompleteQueueCycle() {
  console.log('🧪 COMPLETE QUEUE LIFECYCLE TEST');
  console.log('=================================\n');

  const propertyId = `test-complete-${Date.now()}`;

  try {
    // STEP 1: Add property
    console.log('1️⃣ STEP 1: Adding test property...\n');

    const propertyPayload = {
      opportunityId: propertyId,
      propertyAddress: '888 Complete Test Ave',
      propertyCity: 'Dallas',
      state: 'TX',
      price: 225000,
      bedrooms: 4,
      bathrooms: 2,
      livingArea: 2000,
      yearBuilt: 2018,
      lotSizes: '0.3 acre',
      homeType: 'Single Family',
      zipCode: '75201',
      downPayment: 12,
      interestRate: 7.0,
      termYears: 30,
      description: 'Complete lifecycle test property',
      imageLink: 'https://example.com/test.jpg'
    };

    const createResponse = await fetch(`${baseUrl}/api/gohighlevel/webhook/save-property`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyPayload)
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create property: ${createResponse.status}`);
    }

    console.log('   ✅ Property created\n');

    // Wait for auto-add
    console.log('   ⏳ Waiting 5 seconds for auto-add...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check queue
    const queueQuery1 = query(
      collection(db, 'property_videos'),
      where('propertyId', '==', propertyId)
    );

    const queueSnapshot1 = await getDocs(queueQuery1);
    console.log(`   📊 Queue check: ${queueSnapshot1.size} workflow(s)`);

    if (queueSnapshot1.size === 0) {
      console.log('   ❌ FAILED: Property NOT auto-added to queue\n');
      return { success: false, step: 1 };
    }

    console.log('   ✅ PASSED: Property auto-added to queue\n');

    // STEP 2: Delete property
    console.log('2️⃣ STEP 2: Deleting property...\n');

    await deleteDoc(doc(db, 'properties', propertyId));
    console.log('   ✅ Property deleted from database\n');

    // Check queue still has it
    const queueQuery2 = query(
      collection(db, 'property_videos'),
      where('propertyId', '==', propertyId)
    );

    const queueSnapshot2 = await getDocs(queueQuery2);
    console.log(`   📊 Queue check: ${queueSnapshot2.size} workflow(s)`);

    if (queueSnapshot2.size === 0) {
      console.log('   ⚠️  WARNING: Queue item already deleted (unexpected)\n');
    } else {
      console.log('   ✅ EXPECTED: Queue item still exists after property deletion\n');
    }

    // STEP 3: Run sync cron
    console.log('3️⃣ STEP 3: Running sync cron...\n');

    const cronResponse = await fetch(`${baseUrl}/api/cron/sync-property-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });

    if (!cronResponse.ok) {
      throw new Error(`Cron failed: ${cronResponse.status}`);
    }

    const cronResult = await cronResponse.json();
    console.log('   ✅ Cron completed');
    console.log(`   📊 Results: ${cronResult.added} added, ${cronResult.deleted} deleted\n`);

    // Check queue after cron
    const queueQuery3 = query(
      collection(db, 'property_videos'),
      where('propertyId', '==', propertyId)
    );

    const queueSnapshot3 = await getDocs(queueQuery3);
    console.log(`   📊 Final queue check: ${queueSnapshot3.size} workflow(s)\n`);

    // RESULTS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FINAL RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (queueSnapshot3.size === 0) {
      console.log('✅ SUCCESS! Complete lifecycle working:');
      console.log('   1. ✅ Property auto-added to queue when created');
      console.log('   2. ✅ Queue item persisted after property deletion');
      console.log('   3. ✅ Sync cron auto-deleted invalid queue item\n');
      console.log('🎉 ALL TESTS PASSED!\n');
      return { success: true };
    } else {
      console.log('❌ FAILED! Queue item NOT deleted by sync cron');
      console.log(`   Expected: 0 workflows`);
      console.log(`   Got: ${queueSnapshot3.size} workflows\n`);

      queueSnapshot3.forEach(doc => {
        const data = doc.data();
        console.log(`   Remaining: ${doc.id} (status: ${data.status})`);
      });

      console.log('\n   Cleaning up test data...');
      for (const doc of queueSnapshot3.docs) {
        await deleteDoc(doc.ref);
      }

      return { success: false, step: 3 };
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    return { success: false, error };
  }
}

testCompleteQueueCycle()
  .then(result => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
