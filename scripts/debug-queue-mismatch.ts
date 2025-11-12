#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function debug() {
  const adminDb = await getAdminDb();
  if (!adminDb) process.exit(1);

  // Sample one orphaned property from the queue
  const orphanedId = '02dOcf9u1PBoGeZm4qmc'; // From verification output

  console.log(`\n🔍 Checking property: ${orphanedId}\n`);

  // Check if in queue
  const queueDoc = await adminDb.collection('property_rotation_queue').doc(orphanedId).get();
  console.log(`In queue: ${queueDoc.exists}`);
  if (queueDoc.exists) {
    console.log('Queue data:', queueDoc.data());
  }

  // Check if in properties
  const propDoc = await adminDb.collection('properties').doc(orphanedId).get();
  console.log(`\nIn properties: ${propDoc.exists}`);
  if (propDoc.exists) {
    const data = propDoc.data();
    console.log('Property data:');
    console.log('  status:', data?.status);
    console.log('  isActive:', data?.isActive);
    console.log('  imageUrls:', data?.imageUrls?.length || 0);
  }

  // Check what the cleanup script query actually finds
  console.log('\n📊 Testing cleanup script queries:\n');

  const activePropsQuery = await adminDb.collection('properties')
    .where('isActive', '==', true)
    .where('status', '==', 'active')
    .get();

  console.log(`Active properties query found: ${activePropsQuery.size}`);

  const hasThisProperty = activePropsQuery.docs.some(doc => doc.id === orphanedId);
  console.log(`Contains ${orphanedId}: ${hasThisProperty}`);
}

debug();
