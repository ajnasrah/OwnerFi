/**
 * Check why there are suddenly 850 properties
 */

import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function investigate() {
  console.log('🔍 Investigating property explosion...\n');

  // Check all property collections
  const collections = [
    'properties',
    'property_videos',
    'propertyShowcaseWorkflows'
  ];

  for (const collectionName of collections) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Collection: ${collectionName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      const snapshot = await db.collection(collectionName).count().get();
      const total = snapshot.data().count;
      console.log(`Total count: ${total}\n`);

      if (total === 0) {
        console.log('Empty collection\n');
        continue;
      }

      // Get recent docs to see when they were created
      const recentDocs = await db.collection(collectionName)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      console.log(`Recent ${recentDocs.size} documents:`);
      recentDocs.forEach((doc, i) => {
        const data = doc.data();
        let created = 'Unknown';
        if (data.createdAt) {
          try {
            // Handle both timestamp objects and numbers
            const timestamp = typeof data.createdAt === 'number' ? data.createdAt : data.createdAt.toMillis?.() || data.createdAt;
            created = new Date(timestamp).toISOString();
          } catch (e) {
            created = `Invalid: ${data.createdAt}`;
          }
        }
        const status = data.status || (data.isActive !== undefined ? `isActive=${data.isActive}` : 'N/A');
        const address = data.address || data.propertyAddress || 'N/A';
        console.log(`${i + 1}. ${doc.id}`);
        console.log(`   Created: ${created}`);
        console.log(`   Status: ${status}`);
        console.log(`   Address: ${address}`);
      });

      // Check by status if available
      console.log(`\nBreakdown by status:`);

      const statuses = ['active', 'pending', 'processing', 'completed', 'failed'];
      for (const status of statuses) {
        try {
          const statusSnapshot = await db.collection(collectionName)
            .where('status', '==', status)
            .count()
            .get();
          const count = statusSnapshot.data().count;
          if (count > 0) {
            console.log(`  ${status}: ${count}`);
          }
        } catch (e) {
          // Field might not exist
        }
      }

      // Check isActive for properties collection
      if (collectionName === 'properties') {
        try {
          const activeSnapshot = await db.collection(collectionName)
            .where('isActive', '==', true)
            .count()
            .get();
          console.log(`  isActive=true: ${activeSnapshot.data().count}`);

          const inactiveSnapshot = await db.collection(collectionName)
            .where('isActive', '==', false)
            .count()
            .get();
          console.log(`  isActive=false: ${inactiveSnapshot.data().count}`);
        } catch (e) {
          // Might need index
        }
      }

      // Check creation date ranges
      console.log(`\nCreation timeline (last 24 hours):`);
      const now = Date.now();
      const timeRanges = [
        { label: 'Last hour', start: now - 3600000 },
        { label: 'Last 3 hours', start: now - 3 * 3600000 },
        { label: 'Last 6 hours', start: now - 6 * 3600000 },
        { label: 'Last 12 hours', start: now - 12 * 3600000 },
        { label: 'Last 24 hours', start: now - 24 * 3600000 },
      ];

      for (const range of timeRanges) {
        try {
          const rangeSnapshot = await db.collection(collectionName)
            .where('createdAt', '>=', range.start)
            .count()
            .get();
          const count = rangeSnapshot.data().count;
          if (count > 0) {
            console.log(`  ${range.label}: ${count}`);
          }
        } catch (e) {
          // Might need index
        }
      }

      console.log('');
    } catch (error) {
      console.error(`Error checking ${collectionName}:`, error);
    }
  }

  console.log('\n✅ Investigation complete');
}

investigate().catch(console.error);
