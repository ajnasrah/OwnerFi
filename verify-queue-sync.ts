#!/usr/bin/env tsx
/**
 * Verify Property Rotation Queue Sync
 *
 * This script checks if the property_rotation_queue matches the properties database.
 * It identifies:
 * - Properties that should be in queue but aren't
 * - Properties in queue that shouldn't be (deleted/inactive/no images)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from './src/lib/firebase-admin';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  status: string;
  isActive: boolean;
  imageUrls: string[];
}

interface QueueItem {
  id: string;
  propertyId: string;
  address: string;
  status: 'queued' | 'processing' | 'completed';
}

async function verifyQueueSync() {
  console.log('🔍 Verifying Property Queue Sync...\n');

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Firebase Admin not initialized');
    process.exit(1);
  }

  // 1. Get all active properties with images from database
  console.log('📊 Fetching active properties from database...');
  const propertiesSnapshot = await db.collection('properties')
    .where('status', '==', 'active')
    .where('isActive', '==', true)
    .get();

  const activeProperties = new Map<string, Property>();
  const activePropertiesWithImages = new Map<string, Property>();

  propertiesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const property: Property = {
      id: doc.id,
      address: data.address || 'Unknown',
      city: data.city || 'Unknown',
      state: data.state || 'Unknown',
      status: data.status,
      isActive: data.isActive,
      imageUrls: data.imageUrls || []
    };

    activeProperties.set(doc.id, property);

    // Only properties with images should be in queue
    if (property.imageUrls && property.imageUrls.length > 0) {
      activePropertiesWithImages.set(doc.id, property);
    }
  });

  console.log(`   ✅ Found ${activeProperties.size} active properties`);
  console.log(`   ✅ Found ${activePropertiesWithImages.size} active properties WITH images\n`);

  // 2. Get all properties in rotation queue
  console.log('📊 Fetching rotation queue...');
  const queueSnapshot = await db.collection('property_rotation_queue').get();

  const queueItems = new Map<string, QueueItem>();
  queueSnapshot.docs.forEach(doc => {
    const data = doc.data();
    queueItems.set(doc.id, {
      id: doc.id,
      propertyId: data.propertyId || doc.id,
      address: data.address || 'Unknown',
      status: data.status || 'queued'
    });
  });

  console.log(`   ✅ Found ${queueItems.size} properties in queue\n`);

  // 3. Analyze mismatches
  console.log('🔍 Analyzing Sync Status...\n');

  // Missing from queue (should be added)
  const missingFromQueue: Property[] = [];
  activePropertiesWithImages.forEach((property, id) => {
    if (!queueItems.has(id)) {
      missingFromQueue.push(property);
    }
  });

  // Shouldn't be in queue (should be removed)
  const shouldntBeInQueue: QueueItem[] = [];
  queueItems.forEach((queueItem, id) => {
    const property = activeProperties.get(id);

    if (!property) {
      // Property doesn't exist or isn't active
      shouldntBeInQueue.push(queueItem);
    } else if (!property.imageUrls || property.imageUrls.length === 0) {
      // Property exists but has no images
      shouldntBeInQueue.push(queueItem);
    }
  });

  // 4. Report Results
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (missingFromQueue.length === 0 && shouldntBeInQueue.length === 0) {
    console.log('✅ QUEUE IS IN PERFECT SYNC! 🎉\n');
    console.log(`   • ${activePropertiesWithImages.size} active properties with images`);
    console.log(`   • ${queueItems.size} properties in queue`);
    console.log(`   • 0 mismatches\n`);
  } else {
    console.log('⚠️  SYNC ISSUES DETECTED\n');

    if (missingFromQueue.length > 0) {
      console.log(`❌ MISSING FROM QUEUE (${missingFromQueue.length} properties):`);
      console.log('   These active properties have images but are NOT in the queue:\n');
      missingFromQueue.slice(0, 10).forEach((prop, idx) => {
        console.log(`   ${idx + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`      ID: ${prop.id}`);
        console.log(`      Images: ${prop.imageUrls.length}\n`);
      });
      if (missingFromQueue.length > 10) {
        console.log(`   ... and ${missingFromQueue.length - 10} more\n`);
      }
    }

    if (shouldntBeInQueue.length > 0) {
      console.log(`❌ SHOULDN'T BE IN QUEUE (${shouldntBeInQueue.length} properties):`);
      console.log('   These queue entries are for deleted/inactive/no-image properties:\n');
      shouldntBeInQueue.slice(0, 10).forEach((item, idx) => {
        const prop = activeProperties.get(item.id);
        console.log(`   ${idx + 1}. ${item.address}`);
        console.log(`      ID: ${item.id}`);
        if (!prop) {
          console.log(`      Reason: Property deleted or inactive`);
        } else {
          console.log(`      Reason: No images (${prop.imageUrls?.length || 0} images)`);
        }
        console.log(`      Queue Status: ${item.status}\n`);
      });
      if (shouldntBeInQueue.length > 10) {
        console.log(`   ... and ${shouldntBeInQueue.length - 10} more\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('💡 RECOMMENDATIONS:\n');
    console.log('   1. Run the queue sync manually via:');
    console.log('      curl -X POST http://localhost:3000/api/property/video-cron\n');
    console.log('   2. Or wait for the next scheduled cron run (3x daily)\n');
    console.log('   3. Queue sync has a 10% random trigger, you may need to');
    console.log('      run it multiple times to trigger the sync\n');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // 5. Summary Statistics
  console.log('📊 SUMMARY STATISTICS:\n');
  console.log(`   Total active properties:              ${activeProperties.size}`);
  console.log(`   Active properties with images:        ${activePropertiesWithImages.size}`);
  console.log(`   Properties in queue:                  ${queueItems.size}`);
  console.log(`   Missing from queue:                   ${missingFromQueue.length}`);
  console.log(`   Shouldn't be in queue:                ${shouldntBeInQueue.length}`);
  console.log(`   Sync accuracy:                        ${Math.round((1 - (missingFromQueue.length + shouldntBeInQueue.length) / Math.max(activePropertiesWithImages.size, 1)) * 100)}%\n`);

  // Queue status breakdown
  const queueStatusCounts = {
    queued: 0,
    processing: 0,
    completed: 0
  };
  queueItems.forEach(item => {
    queueStatusCounts[item.status]++;
  });

  console.log('   Queue Status Breakdown:');
  console.log(`      • Queued:      ${queueStatusCounts.queued}`);
  console.log(`      • Processing:  ${queueStatusCounts.processing}`);
  console.log(`      • Completed:   ${queueStatusCounts.completed}\n`);

  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(missingFromQueue.length + shouldntBeInQueue.length > 0 ? 1 : 0);
}

// Run the verification
verifyQueueSync().catch(error => {
  console.error('❌ Error verifying queue sync:', error);
  process.exit(1);
});
