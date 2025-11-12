#!/usr/bin/env tsx
/**
 * One-Time Property Queue Cleanup
 *
 * This script syncs the property_rotation_queue with the properties database:
 * - Removes deleted/inactive properties from queue
 * - Adds missing active properties with images to queue
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function cleanupPropertyQueue() {
  console.log('🧹 Starting Property Queue Cleanup...\n');
  console.log('═'.repeat(60));

  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized');
    process.exit(1);
  }

  // 1. Get all property IDs in queue
  console.log('\n📊 Step 1: Fetching rotation queue...');
  const queueSnapshot = await adminDb.collection('property_rotation_queue').get();
  const queuePropertyIds = new Set(queueSnapshot.docs.map(doc => doc.data().propertyId));
  console.log(`   Found ${queueSnapshot.size} properties in queue`);

  // 2. Get all active property IDs from properties collection
  console.log('\n📊 Step 2: Fetching active properties from database...');
  const propertiesSnapshot = await adminDb.collection('properties')
    .where('isActive', '==', true)
    .where('status', '==', 'active')
    .get();

  const activePropertyIds = new Set<string>();
  const newProperties: string[] = [];

  propertiesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.imageUrls && data.imageUrls.length > 0) {
      activePropertyIds.add(doc.id);
      if (!queuePropertyIds.has(doc.id)) {
        newProperties.push(doc.id);
      }
    }
  });

  console.log(`   Found ${propertiesSnapshot.size} active properties`);
  console.log(`   Found ${activePropertyIds.size} active properties WITH images`);

  // 3. Identify properties to remove (in queue but not active or no images)
  console.log('\n📊 Step 3: Identifying orphaned queue entries...');
  const propertiesToRemove: string[] = [];
  queueSnapshot.docs.forEach(doc => {
    // Use doc.id as the primary key (not doc.data().propertyId which may be stale)
    const queueDocId = doc.id;
    if (!activePropertyIds.has(queueDocId)) {
      propertiesToRemove.push(queueDocId);
    }
  });

  console.log(`   Found ${propertiesToRemove.length} orphaned entries to remove`);
  console.log(`   Found ${newProperties.length} new properties to add`);

  // 4. Remove orphaned entries (batch delete in chunks of 500)
  if (propertiesToRemove.length > 0) {
    console.log('\n🗑️  Step 4: Removing orphaned queue entries...');
    const BATCH_SIZE = 500;
    let removedCount = 0;

    for (let i = 0; i < propertiesToRemove.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = propertiesToRemove.slice(i, i + BATCH_SIZE);

      chunk.forEach(propId => {
        const docRef = adminDb.collection('property_rotation_queue').doc(propId);
        batch.delete(docRef);
      });

      await batch.commit();
      removedCount += chunk.length;
      console.log(`   Removed ${removedCount}/${propertiesToRemove.length}...`);
    }

    console.log(`   ✅ Removed ${removedCount} orphaned entries`);
  } else {
    console.log('\n✅ Step 4: No orphaned entries to remove');
  }

  // 5. Add new properties using admin SDK directly
  if (newProperties.length > 0) {
    console.log(`\n➕ Step 5: Adding ${newProperties.length} new properties to queue...`);
    let addedCount = 0;
    let skippedCount = 0;

    // Get current max position in queue
    const maxPosSnapshot = await adminDb.collection('property_rotation_queue')
      .orderBy('position', 'desc')
      .limit(1)
      .get();
    let maxPosition = maxPosSnapshot.empty ? 0 : maxPosSnapshot.docs[0].data().position;

    for (const propId of newProperties) {
      try {
        // Check if already exists
        const existingDoc = await adminDb.collection('property_rotation_queue').doc(propId).get();
        if (existingDoc.exists) {
          skippedCount++;
          continue;
        }

        // Get property data
        const propertyDoc = await adminDb.collection('properties').doc(propId).get();
        if (!propertyDoc.exists) {
          console.error(`   Property ${propId} not found in database`);
          continue;
        }

        const property = propertyDoc.data();
        if (!property) continue;

        // Calculate down payment (simple version - use amount if available, else calculate from percent)
        let downPayment = property.downPaymentAmount || 0;
        if (!downPayment && property.downPaymentPercent && property.listPrice) {
          downPayment = Math.round((property.downPaymentPercent / 100) * property.listPrice);
        }

        // Add to queue
        maxPosition++;
        await adminDb.collection('property_rotation_queue').doc(propId).set({
          id: propId,
          propertyId: propId,
          address: property.address || 'Unknown Address',
          city: property.city || 'Unknown City',
          state: property.state || 'Unknown',
          downPayment,
          imageUrl: property.imageUrls?.[0] || '',
          position: maxPosition,
          videoCount: 0,
          currentCycleCount: 0,
          status: 'queued',
          updatedAt: Date.now()
        });

        addedCount++;
        if (addedCount % 10 === 0) {
          console.log(`   Added ${addedCount}/${newProperties.length}...`);
        }
      } catch (err: any) {
        console.error(`   Failed to add ${propId}:`, err.message);
      }
    }

    console.log(`   ✅ Added ${addedCount} new properties`);
    if (skippedCount > 0) {
      console.log(`   ⏭️  Skipped ${skippedCount} (already in queue)`);
    }
  } else {
    console.log('\n✅ Step 5: No new properties to add');
  }

  // 6. Final verification
  console.log('\n📊 Step 6: Verifying cleanup...');
  const finalQueueSnapshot = await adminDb.collection('property_rotation_queue').get();
  const finalQueueSize = finalQueueSnapshot.size;
  const expectedSize = activePropertyIds.size;

  console.log(`   Queue size: ${finalQueueSize}`);
  console.log(`   Expected size: ${expectedSize}`);
  console.log(`   Match: ${finalQueueSize === expectedSize ? '✅ YES' : '❌ NO'}`);

  // 7. Summary
  console.log('\n═'.repeat(60));
  console.log('📊 CLEANUP SUMMARY:');
  console.log(`   Orphaned entries removed: ${propertiesToRemove.length}`);
  console.log(`   New properties added: ${newProperties.length}`);
  console.log(`   Final queue size: ${finalQueueSize}`);
  console.log(`   Active properties with images: ${activePropertyIds.size}`);
  console.log(`   Sync accuracy: ${Math.round((finalQueueSize / Math.max(expectedSize, 1)) * 100)}%`);
  console.log('═'.repeat(60));

  console.log('\n✅ Property queue cleanup complete!\n');

  process.exit(0);
}

cleanupPropertyQueue().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
