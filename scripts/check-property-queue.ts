#!/usr/bin/env npx tsx
/**
 * Check property social media queue system
 * Verifies that properties are being automatically added to the rotation queue
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function checkPropertyQueue() {
  console.log('🔍 Checking Property Social Media Queue System\n');
  console.log('='.repeat(80));

  try {
    // 1. Count properties in rotation queue
    console.log('\n📋 Checking property_rotation_queue collection...');
    const queueSnapshot = await db.collection('property_rotation_queue').get();
    console.log(`   ✅ Found ${queueSnapshot.size} properties in queue\n`);

    // 2. Count total properties
    console.log('📦 Checking all properties...');
    const allPropsSnapshot = await db.collection('properties').get();
    console.log(`   ✅ Total properties: ${allPropsSnapshot.size}\n`);

    // 3. Count eligible properties (active + has images)
    console.log('🎯 Counting eligible properties (active + has images)...');
    let eligible = 0;
    let activeButNoImages = 0;
    let hasImagesButInactive = 0;
    let inactive = 0;

    allPropsSnapshot.forEach(doc => {
      const data = doc.data();
      const isActive = data.status === 'active' && data.isActive === true;
      const hasImages = data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0;

      if (isActive && hasImages) {
        eligible++;
      } else if (isActive && !hasImages) {
        activeButNoImages++;
      } else if (!isActive && hasImages) {
        hasImagesButInactive++;
      } else {
        inactive++;
      }
    });

    console.log(`   ✅ Eligible properties: ${eligible}`);
    console.log(`   ⚠️  Active but no images: ${activeButNoImages}`);
    console.log(`   ⚠️  Has images but inactive: ${hasImagesButInactive}`);
    console.log(`   ⏸️  Inactive/no images: ${inactive}\n`);

    // 4. Get queue entries and check which properties are in queue
    const queuedPropertyIds = new Set<string>();
    queueSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.propertyId) {
        queuedPropertyIds.add(data.propertyId);
      }
    });

    console.log('🔗 Checking queue coverage...');
    console.log(`   Queue entries: ${queueSnapshot.size}`);
    console.log(`   Unique property IDs in queue: ${queuedPropertyIds.size}\n`);

    // 5. Find eligible properties NOT in queue
    const missingFromQueue: Array<{id: string, address: string, createdAt: any}> = [];

    allPropsSnapshot.forEach(doc => {
      const data = doc.data();
      const isActive = data.status === 'active' && data.isActive === true;
      const hasImages = data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0;

      if (isActive && hasImages && !queuedPropertyIds.has(doc.id)) {
        missingFromQueue.push({
          id: doc.id,
          address: data.address || 'Unknown address',
          createdAt: data.createdAt
        });
      }
    });

    // Sort by creation date (newest first)
    missingFromQueue.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    console.log('='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));
    console.log(`✅ Properties in queue: ${queuedPropertyIds.size}`);
    console.log(`🎯 Eligible properties: ${eligible}`);
    console.log(`❌ Missing from queue: ${missingFromQueue.length}`);

    if (missingFromQueue.length === 0) {
      console.log('\n🎉 SUCCESS! All eligible properties are in the queue!\n');
    } else {
      const percentage = ((queuedPropertyIds.size / eligible) * 100).toFixed(1);
      console.log(`📈 Coverage: ${percentage}%\n`);

      console.log(`⚠️  ${missingFromQueue.length} eligible properties NOT in queue:\n`);

      // Show first 10
      const toShow = missingFromQueue.slice(0, 10);
      toShow.forEach((prop, idx) => {
        let date = 'Unknown';
        try {
          if (prop.createdAt && typeof prop.createdAt === 'number' && prop.createdAt > 0) {
            date = new Date(prop.createdAt).toISOString().split('T')[0];
          } else if (prop.createdAt) {
            date = String(prop.createdAt);
          }
        } catch {
          date = 'Invalid';
        }
        console.log(`   ${idx + 1}. ${prop.address} (Created: ${date})`);
        console.log(`      ID: ${prop.id}\n`);
      });

      if (missingFromQueue.length > 10) {
        console.log(`   ... and ${missingFromQueue.length - 10} more\n`);
      }
    }

    console.log('='.repeat(80));

    // 6. Check recent queue additions
    console.log('\n📅 Recent queue additions (last 10):\n');
    const recentQueue = await db.collection('property_rotation_queue')
      .orderBy('addedAt', 'desc')
      .limit(10)
      .get();

    if (recentQueue.empty) {
      console.log('   ⚠️  No properties in queue\n');
    } else {
      for (const doc of recentQueue.docs) {
        const data = doc.data();
        const addedAt = data.addedAt ? new Date(data.addedAt).toISOString() : 'Unknown';

        // Get property details
        let address = 'Unknown';
        if (data.propertyId) {
          const propDoc = await db.collection('properties').doc(data.propertyId).get();
          if (propDoc.exists) {
            address = propDoc.data()?.address || 'Unknown';
          }
        }

        console.log(`   • ${address}`);
        console.log(`     Added: ${addedAt}`);
        console.log(`     Property ID: ${data.propertyId}\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking queue:', error);
    throw error;
  }
}

checkPropertyQueue().catch(console.error);
