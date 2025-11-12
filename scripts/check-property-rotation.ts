/**
 * Check property rotation system properly
 * Properties should cycle through the queue - when a video is posted,
 * the property goes to the back of the queue
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
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

async function checkPropertyRotation() {
  console.log('🔄 Checking Property Rotation System');
  console.log('=====================================\n');

  try {
    // 1. Get all properties
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
        status: prop.status,
        isActive: prop.isActive,
        hasImages: !!(prop.imageUrls && prop.imageUrls.length > 0),
        createdAt: prop.createdAt,
      });
    });

    const activeWithImages = Array.from(allProperties.values()).filter(
      p => p.status === 'active' && p.isActive && p.hasImages
    );

    console.log(`   Total properties: ${allProperties.size}`);
    console.log(`   Active with images: ${activeWithImages.length}\n`);

    // 2. Get rotation queue items
    console.log('📊 Loading rotation queue (property_videos)...');
    const queueQuery = query(
      collection(db, 'property_videos'),
      orderBy('updatedAt', 'asc')
    );
    const queueSnapshot = await getDocs(queueQuery);

    console.log(`   Queue items: ${queueSnapshot.size}\n`);

    // Analyze queue items
    const queueStats = {
      pending: 0,
      completed: 0,
      failed: 0,
      posting: 0,
      video_processing: 0,
      other: 0,
      withValidProperty: 0,
      withInvalidProperty: 0,
      withDeletedProperty: 0,
    };

    const queueItems: any[] = [];
    const propertyIdInQueue = new Set();

    queueSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const workflowId = doc.id;

      queueItems.push({
        workflowId,
        propertyId: item.propertyId,
        status: item.status,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
      });

      propertyIdInQueue.add(item.propertyId);

      // Count by status
      const status = item.status || 'unknown';
      if (status === 'pending') queueStats.pending++;
      else if (status === 'completed') queueStats.completed++;
      else if (status === 'failed') queueStats.failed++;
      else if (status === 'posting') queueStats.posting++;
      else if (status === 'video_processing') queueStats.video_processing++;
      else queueStats.other++;

      // Check if property exists and is valid
      const property = allProperties.get(item.propertyId);
      if (!property) {
        queueStats.withDeletedProperty++;
      } else if (property.status !== 'active' || !property.isActive) {
        queueStats.withInvalidProperty++;
      } else {
        queueStats.withValidProperty++;
      }
    });

    // 3. Check for properties missing from queue
    const missingFromQueue = activeWithImages.filter(
      prop => !propertyIdInQueue.has(prop.id)
    );

    // 4. Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ROTATION QUEUE ANALYSIS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Queue Status Breakdown:');
    console.log(`   Pending: ${queueStats.pending}`);
    console.log(`   Completed: ${queueStats.completed}`);
    console.log(`   Failed: ${queueStats.failed}`);
    console.log(`   Posting: ${queueStats.posting}`);
    console.log(`   Video Processing: ${queueStats.video_processing}`);
    console.log(`   Other: ${queueStats.other}\n`);

    console.log('Queue Validity:');
    console.log(`   ✅ Valid properties in queue: ${queueStats.withValidProperty}`);
    console.log(`   ⚠️  Inactive properties in queue: ${queueStats.withInvalidProperty}`);
    console.log(`   ❌ Deleted properties in queue: ${queueStats.withDeletedProperty}\n`);

    console.log('Coverage:');
    console.log(`   Properties that should be in queue: ${activeWithImages.length}`);
    console.log(`   Properties actually in queue: ${propertyIdInQueue.size}`);
    console.log(`   Missing from queue: ${missingFromQueue.length}\n`);

    if (missingFromQueue.length > 0) {
      console.log(`❌ ${missingFromQueue.length} active properties are MISSING from rotation!\n`);
      console.log('Sample of missing properties (first 10):');
      missingFromQueue.slice(0, 10).forEach(prop => {
        console.log(`   • ${prop.address}, ${prop.city}, ${prop.state}`);
      });
      console.log('\n💡 These properties should be automatically added when:');
      console.log('   1. Property is saved via webhook (auto-add logic)');
      console.log('   2. Cron job checks for missing properties and adds them\n');
    } else {
      console.log('✅ All active properties are in the rotation queue!\n');
    }

    if (queueStats.withDeletedProperty > 0 || queueStats.withInvalidProperty > 0) {
      console.log(`⚠️  ${queueStats.withDeletedProperty + queueStats.withInvalidProperty} queue items reference invalid/deleted properties\n`);
      console.log('💡 These should be cleaned up to keep the queue efficient.\n');
    }

    // Show next few properties in rotation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 NEXT PROPERTIES IN ROTATION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const nextInQueue = queueItems
      .filter(item => {
        const prop = allProperties.get(item.propertyId);
        return prop && prop.status === 'active' && prop.isActive;
      })
      .slice(0, 10);

    if (nextInQueue.length > 0) {
      nextInQueue.forEach((item, index) => {
        const prop = allProperties.get(item.propertyId);
        if (prop) {
          console.log(`${index + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
          console.log(`   Status: ${item.status}`);
          console.log(`   Workflow: ${item.workflowId}`);
          console.log('');
        }
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

checkPropertyRotation().catch(console.error);
