/**
 * Check if property rotation queue is in sync with properties database
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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

async function checkPropertyQueueSync() {
  console.log('🔍 Checking Property Queue Synchronization');
  console.log('==========================================\n');

  try {
    // 1. Get all properties from properties collection
    console.log('📊 Loading properties database...');
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const allProperties = new Map();

    propertiesSnapshot.docs.forEach(doc => {
      const prop = doc.data();
      allProperties.set(doc.id, {
        id: doc.id,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        price: prop.price,
        status: prop.status,
        isActive: prop.isActive,
        hasImages: !!(prop.imageUrls && prop.imageUrls.length > 0),
      });
    });

    console.log(`   Total properties: ${allProperties.size}\n`);

    // 2. Get property_videos (rotation queue)
    console.log('📊 Loading property rotation queue...');
    const queueSnapshot = await getDocs(collection(db, 'property_videos'));
    const queuedProperties = new Map();

    queueSnapshot.docs.forEach(doc => {
      const workflow = doc.data();
      queuedProperties.set(workflow.propertyId, {
        workflowId: doc.id,
        propertyId: workflow.propertyId,
        status: workflow.status,
        createdAt: workflow.createdAt,
      });
    });

    console.log(`   Properties in queue: ${queuedProperties.size}\n`);

    // 3. Check for mismatches
    console.log('🔍 Analyzing synchronization...\n');

    // Properties that should be in queue (active with images) but aren't
    const shouldBeInQueue: any[] = [];
    const activeProperties: any[] = [];

    allProperties.forEach((prop, propId) => {
      if (prop.status === 'active' && prop.isActive && prop.hasImages) {
        activeProperties.push(prop);
        if (!queuedProperties.has(propId)) {
          shouldBeInQueue.push(prop);
        }
      }
    });

    // Properties in queue that don't exist or aren't active
    const shouldNotBeInQueue: any[] = [];

    queuedProperties.forEach((workflow, propId) => {
      const property = allProperties.get(propId);

      if (!property) {
        shouldNotBeInQueue.push({
          workflowId: workflow.workflowId,
          propertyId: propId,
          reason: 'Property does not exist in database',
        });
      } else if (property.status !== 'active' || !property.isActive) {
        shouldNotBeInQueue.push({
          workflowId: workflow.workflowId,
          propertyId: propId,
          address: property.address,
          reason: `Property not active (status: ${property.status}, isActive: ${property.isActive})`,
        });
      } else if (!property.hasImages) {
        shouldNotBeInQueue.push({
          workflowId: workflow.workflowId,
          propertyId: propId,
          address: property.address,
          reason: 'Property has no images',
        });
      }
    });

    // 4. Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total properties in database: ${allProperties.size}`);
    console.log(`Active properties with images: ${activeProperties.length}`);
    console.log(`Properties in rotation queue: ${queuedProperties.size}\n`);

    if (shouldBeInQueue.length > 0) {
      console.log(`❌ MISSING FROM QUEUE: ${shouldBeInQueue.length} properties\n`);
      console.log('These properties should be in the queue but are NOT:\n');

      shouldBeInQueue.forEach(prop => {
        console.log(`   • ${prop.id}`);
        console.log(`     Address: ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`     Price: $${prop.price?.toLocaleString()}`);
        console.log(`     Status: ${prop.status}, Active: ${prop.isActive}`);
        console.log('');
      });
    } else {
      console.log('✅ All active properties with images are in the queue!\n');
    }

    if (shouldNotBeInQueue.length > 0) {
      console.log(`❌ SHOULD NOT BE IN QUEUE: ${shouldNotBeInQueue.length} entries\n`);
      console.log('These entries should NOT be in the queue:\n');

      shouldNotBeInQueue.forEach(item => {
        console.log(`   • Workflow: ${item.workflowId}`);
        console.log(`     Property ID: ${item.propertyId}`);
        if (item.address) {
          console.log(`     Address: ${item.address}`);
        }
        console.log(`     Reason: ${item.reason}`);
        console.log('');
      });
    } else {
      console.log('✅ No invalid entries in the queue!\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (shouldBeInQueue.length === 0 && shouldNotBeInQueue.length === 0) {
      console.log('🎉 PERFECT SYNC! Queue matches the properties database.\n');
    } else {
      console.log('⚠️  SYNCHRONIZATION ISSUES DETECTED!\n');
      console.log('💡 Actions needed:');

      if (shouldBeInQueue.length > 0) {
        console.log(`   1. Add ${shouldBeInQueue.length} missing properties to queue`);
      }

      if (shouldNotBeInQueue.length > 0) {
        console.log(`   2. Remove ${shouldNotBeInQueue.length} invalid entries from queue`);
      }

      console.log('\n   Would you like me to fix these issues?');
    }

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

checkPropertyQueueSync().catch(console.error);
