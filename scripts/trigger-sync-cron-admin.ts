#!/usr/bin/env tsx
/**
 * Trigger Property Queue Sync Cron (Admin SDK version)
 *
 * Uses Admin SDK to trigger sync from server side
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';
import { addPropertyToShowcaseQueue } from '../src/lib/property-workflow';

async function triggerSyncAdmin() {
  console.log('🔄 Triggering Property Queue Sync (Admin SDK)\n');
  console.log('='.repeat(70));

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return;
  }

  // Get stats before sync
  console.log('\n📊 BEFORE SYNC:');
  const queueBefore = await db.collection('propertyShowcaseWorkflows').get();
  const queuedBefore = (await db.collection('propertyShowcaseWorkflows').where('queueStatus', '==', 'queued').get()).size;
  console.log(`   Total: ${queueBefore.size}`);
  console.log(`   Queued: ${queuedBefore}`);

  // Get all active properties with images
  console.log('\n🔍 Finding active properties...');
  const propertiesSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .where('status', '==', 'active')
    .get();

  const propertiesWithImages = propertiesSnapshot.docs.filter(doc => {
    const data = doc.data();
    return data.imageUrls && data.imageUrls.length > 0;
  });

  console.log(`   Found ${propertiesSnapshot.size} active properties`);
  console.log(`   With images: ${propertiesWithImages.length}`);

  // Get properties already in queue
  const queueSnapshot = await db.collection('propertyShowcaseWorkflows').get();
  const queuedPropertyIds = new Set(queueSnapshot.docs.map(doc => doc.data().propertyId));

  console.log(`   Already in queue: ${queuedPropertyIds.size}`);

  // Find missing properties
  const missingProperties = propertiesWithImages.filter(doc => !queuedPropertyIds.has(doc.id));
  console.log(`   Missing from queue: ${missingProperties.length}`);

  // Add missing properties
  let added = 0;
  let errors = 0;

  if (missingProperties.length > 0) {
    console.log('\n➕ Adding missing properties to queue...');

    for (const propDoc of missingProperties) {
      const prop = propDoc.data();
      try {
        const workflowId = `property_15sec_en_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // Get current max position
        const maxPosQuery = await db.collection('propertyShowcaseWorkflows')
          .where('queueStatus', '==', 'queued')
          .orderBy('queuePosition', 'desc')
          .limit(1)
          .get();

        const maxPosition = maxPosQuery.empty ? 0 : maxPosQuery.docs[0].data().queuePosition;

        const workflow = {
          id: workflowId,
          propertyId: propDoc.id,
          queueStatus: 'queued',
          queuePosition: maxPosition + 1,
          queueAddedAt: Date.now(),
          totalVideosGenerated: 0,
          currentCycleCount: 0,
          status: 'pending',
          address: prop.address,
          city: prop.city,
          state: prop.state,
          downPayment: prop.downPaymentAmount,
          monthlyPayment: prop.monthlyPayment,
          variant: '15sec',
          language: 'en',
          retryCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await db.collection('propertyShowcaseWorkflows').doc(workflowId).set(workflow);
        added++;
        console.log(`   ✅ Added: ${prop.address} (${prop.city}, ${prop.state}) - Position ${workflow.queuePosition}`);
      } catch (err) {
        errors++;
        console.error(`   ❌ Error adding ${prop.address}:`, err);
      }
    }
  }

  // Remove deleted properties
  const activePropertyIds = new Set(propertiesWithImages.map(doc => doc.id));
  let removed = 0;

  console.log('\n🗑️  Checking for deleted properties in queue...');
  for (const workflowDoc of queueSnapshot.docs) {
    const workflow = workflowDoc.data();

    // Skip if currently processing
    if (workflow.queueStatus === 'processing') {
      continue;
    }

    if (!activePropertyIds.has(workflow.propertyId)) {
      await workflowDoc.ref.delete();
      removed++;
      console.log(`   🗑️  Removed: ${workflow.propertyId} (${workflow.address || 'N/A'})`);
    }
  }

  // Get stats after sync
  console.log('\n📊 AFTER SYNC:');
  const queueAfter = await db.collection('propertyShowcaseWorkflows').get();
  const queuedAfter = (await db.collection('propertyShowcaseWorkflows').where('queueStatus', '==', 'queued').get()).size;
  console.log(`   Total: ${queueAfter.size}`);
  console.log(`   Queued: ${queuedAfter}`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Sync Complete!');
  console.log('='.repeat(70));
  console.log(`\n📈 Changes:`);
  console.log(`   Added: ${added} properties`);
  console.log(`   Removed: ${removed} properties`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Net Change: ${added - removed > 0 ? '+' : ''}${added - removed}`);
  console.log('');
}

triggerSyncAdmin().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
