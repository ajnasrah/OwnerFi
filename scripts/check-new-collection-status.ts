#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function check() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to initialize Firebase Admin SDK');
    return;
  }

  console.log('Checking propertyShowcaseWorkflows collection...\n');

  const snapshot = await db.collection('propertyShowcaseWorkflows').limit(5).get();
  console.log(`Total documents in sample: ${snapshot.size}`);

  if (snapshot.size === 0) {
    console.log('\n⚠️  Collection is EMPTY!');
    console.log('This is expected if you haven\'t run the migration yet.');
    console.log('\nRun these commands to migrate:');
    console.log('  1. npx tsx scripts/cleanup-old-property-system.ts --confirm');
    console.log('  2. npx tsx scripts/populate-new-property-queue.ts');
  } else {
    console.log('\n✅ Collection has data. Sample entries:\n');
    snapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i + 1}. ${doc.id}`);
      console.log(`   Property: ${data.propertyId}`);
      console.log(`   Address: ${data.address || 'N/A'}`);
      console.log(`   Queue Status: ${data.queueStatus || 'N/A'}`);
      console.log(`   Status: ${data.status || 'N/A'}`);
      console.log(`   Position: ${data.queuePosition || 'N/A'}`);
      console.log('');
    });
  }

  // Check properties collection
  const propertiesSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .where('status', '==', 'active')
    .limit(5)
    .get();

  const withImages = propertiesSnapshot.docs.filter(doc => {
    const data = doc.data();
    return data.imageUrls && data.imageUrls.length > 0;
  });

  console.log(`\n📊 Active properties in database:`);
  console.log(`   Total active (sample): ${propertiesSnapshot.size}`);
  console.log(`   With images (sample): ${withImages.length}`);
}

check().catch(console.error);
