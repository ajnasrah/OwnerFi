/**
 * Clear property queue and repopulate with all eligible properties
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

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

async function clearAndRepopulate() {
  console.log('🔄 Clearing and Repopulating Property Queue\n');
  console.log('='.repeat(70));

  // Step 1: Clear existing queue
  console.log('\n📋 Step 1: Clearing existing queue...');
  const queueSnapshot = await getDocs(collection(db, 'property_rotation_queue'));

  console.log(`   Found ${queueSnapshot.size} items in queue`);

  for (const docSnap of queueSnapshot.docs) {
    await deleteDoc(doc(db, 'property_rotation_queue', docSnap.id));
  }

  console.log(`   ✅ Cleared ${queueSnapshot.size} items from queue`);

  // Step 2: Repopulate queue
  console.log('\n📋 Step 2: Repopulating queue with all properties...');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const adminSecret = process.env.ADMIN_SECRET_KEY;

  const response = await fetch(`${baseUrl}/api/property/populate-queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminSecret}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`   ❌ Failed: ${response.status}`);
    console.error(JSON.stringify(data, null, 2));
    return;
  }

  console.log(`   ✅ Successfully populated queue!`);
  console.log(`   Added: ${data.added} properties`);
  console.log(`   Skipped: ${data.skipped} (already in queue)`);
  console.log(`   Total in queue: ${data.totalInQueue}`);
  console.log(`   Rotation cycle: ~${data.rotationDays} days`);

  if (data.nextProperty) {
    console.log(`\n   🎯 Next property to process:`);
    console.log(`      Address: ${data.nextProperty.address}`);
    console.log(`      City: ${data.nextProperty.city}, ${data.nextProperty.state}`);
    console.log(`      Property ID: ${data.nextProperty.propertyId}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Queue cleared and repopulated!\n');
}

clearAndRepopulate().catch(console.error);
