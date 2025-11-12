/**
 * Sync property rotation queue - add all missing properties
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

async function syncPropertyQueue() {
  console.log('🔄 Syncing Property Rotation Queue');
  console.log('===================================\n');

  try {
    // 1. Get all properties
    console.log('📊 Loading properties...');
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const allProperties = new Map();

    propertiesSnapshot.docs.forEach(doc => {
      const prop = doc.data();
      if (prop.status === 'active' && prop.isActive && prop.imageUrls && prop.imageUrls.length > 0) {
        allProperties.set(doc.id, {
          id: doc.id,
          address: prop.address,
          city: prop.city,
          state: prop.state,
          price: prop.price,
          imageUrls: prop.imageUrls,
        });
      }
    });

    console.log(`   Found ${allProperties.size} active properties with images\n`);

    // 2. Get queued properties
    console.log('📊 Loading queue...');
    const queueSnapshot = await getDocs(collection(db, 'property_videos'));
    const queuedPropertyIds = new Set();

    queueSnapshot.docs.forEach(doc => {
      const workflow = doc.data();
      queuedPropertyIds.add(workflow.propertyId);
    });

    console.log(`   ${queuedPropertyIds.size} properties already in queue\n`);

    // 3. Find missing properties
    const missingProperties: any[] = [];
    allProperties.forEach((prop, propId) => {
      if (!queuedPropertyIds.has(propId)) {
        missingProperties.push(prop);
      }
    });

    console.log(`📋 Missing from queue: ${missingProperties.length} properties\n`);

    if (missingProperties.length === 0) {
      console.log('✅ All properties are already in the queue!');
      return;
    }

    // 4. Add missing properties to queue
    console.log('🔧 Adding missing properties to queue...\n');

    let added = 0;
    let failed = 0;

    for (const prop of missingProperties) {
      try {
        // Create workflow entry
        const workflowId = `prop-${prop.id}-${Date.now()}`;
        const workflowData = {
          propertyId: prop.id,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: 'sync_script',
        };

        await setDoc(doc(db, 'property_videos', workflowId), workflowData);

        added++;

        if (added % 50 === 0) {
          console.log(`   Progress: ${added}/${missingProperties.length} added...`);
        }

      } catch (error) {
        failed++;
        console.error(`   ❌ Failed to add ${prop.id}:`, error);
      }
    }

    console.log(`\n✅ Sync complete!`);
    console.log(`   Added: ${added}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total in queue now: ${queuedPropertyIds.size + added}\n`);

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

syncPropertyQueue().catch(console.error);
