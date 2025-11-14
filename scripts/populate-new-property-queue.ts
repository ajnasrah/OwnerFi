#!/usr/bin/env tsx
/**
 * Populate New Property Queue
 *
 * Populates the new simplified propertyShowcaseWorkflows collection
 * with all active properties that have images.
 *
 * Run after cleanup-old-property-system.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { addPropertyToShowcaseQueue, getPropertyQueueStats } from '../src/lib/property-workflow';
import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function populate() {
  console.log('🏡 Property Queue Population (New System)\n');
  console.log('='.repeat(70));

  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  // Get current queue stats
  console.log('\n📊 Checking current queue...');
  const currentStats = await getPropertyQueueStats();
  console.log(`   Total in queue: ${currentStats.total} properties`);
  console.log(`   Queued: ${currentStats.queued}`);
  console.log(`   Processing: ${currentStats.processing}`);
  console.log(`   Completed: ${currentStats.completed}\n`);

  if (currentStats.total > 0) {
    console.log('⚠️  Queue already has entries!');
    console.log('   This script should only be run on an empty queue.');
    console.log('   Run cleanup-old-property-system.ts first if you want to start fresh.\n');

    // Ask for confirmation
    const args = process.argv.slice(2);
    if (!args.includes('--force')) {
      console.log('❌ Aborted: Run with --force to add properties anyway');
      return;
    }

    console.log('✅ --force flag provided, continuing...\n');
  }

  // Get all active properties with images
  console.log('🔍 Finding eligible properties...');
  const propertiesQuery = query(
    collection(db, 'properties'),
    where('status', '==', 'active'),
    where('isActive', '==', true)
  );

  const snapshot = await getDocs(propertiesQuery);
  console.log(`   Found ${snapshot.size} active properties\n`);

  if (snapshot.empty) {
    console.log('⚠️  No active properties found');
    return;
  }

  // Filter to properties with images
  const eligibleProperties = snapshot.docs.filter(doc => {
    const property = doc.data();
    return property.imageUrls && property.imageUrls.length > 0;
  });

  console.log(`✅ ${eligibleProperties.length} properties have images and are ready\n`);

  // Add to queue
  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const docSnap of eligibleProperties) {
    const property = docSnap.data();

    try {
      await addPropertyToShowcaseQueue(
        docSnap.id,
        {
          address: property.address,
          city: property.city,
          state: property.state,
          downPayment: property.downPaymentAmount,
          monthlyPayment: property.monthlyPayment
        },
        '15sec', // Default to 15-second videos
        'en'     // Default to English
      );

      added++;
      console.log(`✅ [${added}/${eligibleProperties.length}] ${property.address} (${property.city}, ${property.state})`);

    } catch (error) {
      if (error instanceof Error && error.message.includes('already in queue')) {
        skipped++;
        console.log(`⏭️  [${added + skipped}/${eligibleProperties.length}] ${property.address} (already in queue)`);
      } else {
        errors++;
        console.error(`❌ [${added + skipped + errors}/${eligibleProperties.length}] Error adding ${property.address}:`, error);
      }
    }
  }

  // Final stats
  console.log('\n' + '='.repeat(70));
  console.log('📊 Population Summary');
  console.log('='.repeat(70));
  console.log(`✅ Added: ${added} properties`);
  console.log(`⏭️  Skipped: ${skipped} properties (already in queue)`);
  console.log(`❌ Errors: ${errors} properties`);

  const finalStats = await getPropertyQueueStats();
  console.log(`\n📋 Final queue size: ${finalStats.total} properties`);
  console.log(`   Queued: ${finalStats.queued}`);
  console.log(`   Processing: ${finalStats.processing}`);
  console.log(`   Completed: ${finalStats.completed}`);

  if (finalStats.nextProperty) {
    console.log(`\n🎬 Next video will be:`);
    console.log(`   ${finalStats.nextProperty.address}`);
    console.log(`   ${finalStats.nextProperty.city}, ${finalStats.nextProperty.state}`);
    console.log(`   $${finalStats.nextProperty.downPayment.toLocaleString()} down`);
    console.log(`   Variant: ${finalStats.nextProperty.variant}`);
    console.log(`   Language: ${finalStats.nextProperty.language}`);
  }

  console.log('\n💡 The rotation queue is now active!');
  console.log('   - Properties will cycle continuously');
  console.log('   - Each property goes to back of queue after video');
  console.log('   - Next cron run: Check vercel.json for schedule');
  console.log(`   - With ${finalStats.total} properties and 5 videos/day:`);
  console.log(`     Each property showcased every ${Math.ceil(finalStats.total / 5)} days\n`);

  console.log('🚀 Next step: Test the cron job');
  console.log('   curl -X POST http://localhost:3000/api/property/video-cron-new \\');
  console.log('     -H "Authorization: Bearer $CRON_SECRET"\n');
}

populate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
