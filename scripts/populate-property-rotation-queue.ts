#!/usr/bin/env tsx
/**
 * Populate Property Rotation Queue
 *
 * Adds all active properties with < $15k down payment to the rotation queue.
 * Properties will continuously rotate - after showing, they go to back of queue.
 *
 * Usage:
 *   npx tsx scripts/populate-property-rotation-queue.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { addToPropertyRotationQueue, getPropertyRotationStats } from '../src/lib/feed-store-firestore';
import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function main() {
  console.log('🏡 Property Rotation Queue Population Script\n');

  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  // Get current queue stats
  console.log('📊 Checking current queue...');
  const currentStats = await getPropertyRotationStats();
  console.log(`   Current queue size: ${currentStats.total} properties`);
  console.log(`   Queued: ${currentStats.queued}`);
  console.log(`   Processing: ${currentStats.processing}\n`);

  // Get all active properties with < $15k down
  console.log('🔍 Finding eligible properties...');
  const propertiesQuery = query(
    collection(db, 'properties'),
    where('status', '==', 'active'),
    where('isActive', '==', true),
    where('downPaymentAmount', '<', 15000)
  );

  const snapshot = await getDocs(propertiesQuery);
  console.log(`   Found ${snapshot.size} eligible properties\n`);

  if (snapshot.empty) {
    console.log('⚠️  No eligible properties found');
    console.log('   Make sure you have active properties with downPaymentAmount < $15,000');
    return;
  }

  // Filter to properties with images
  const eligibleProperties = snapshot.docs.filter(doc => {
    const property = doc.data();
    return property.imageUrls && property.imageUrls.length > 0;
  });

  console.log(`✅ ${eligibleProperties.length} properties have images and are ready\n`);

  // Add to rotation queue
  let added = 0;
  let skipped = 0;

  for (const docSnap of eligibleProperties) {
    const property = docSnap.data();

    try {
      await addToPropertyRotationQueue(docSnap.id);
      added++;
      console.log(`✅ Added: ${property.address} (${property.city}, ${property.state})`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already in rotation queue')) {
        skipped++;
        console.log(`⏭️  Skipped: ${property.address} (already in queue)`);
      } else {
        console.error(`❌ Error adding ${property.address}:`, error);
      }
    }
  }

  // Final stats
  console.log('\n' + '='.repeat(60));
  console.log('📊 Population Summary');
  console.log('='.repeat(60));
  console.log(`✅ Added: ${added} properties`);
  console.log(`⏭️  Skipped: ${skipped} properties (already in queue)`);

  const finalStats = await getPropertyRotationStats();
  console.log(`📋 Final queue size: ${finalStats.total} properties`);

  if (finalStats.nextProperty) {
    console.log(`\n🎬 Next video will be:`);
    console.log(`   ${finalStats.nextProperty.address}`);
    console.log(`   ${finalStats.nextProperty.city}, ${finalStats.nextProperty.state}`);
    console.log(`   $${finalStats.nextProperty.downPayment.toLocaleString()} down`);
  }

  console.log('\n💡 The rotation queue is now active!');
  console.log('   - Properties will cycle continuously');
  console.log('   - Each property goes to back of queue after video');
  console.log('   - Next cron run: Check vercel.json for schedule');
  console.log(`   - With ${finalStats.total} properties and 5 videos/day:`);
  console.log(`     Each property showcased every ${Math.ceil(finalStats.total / 5)} days\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
