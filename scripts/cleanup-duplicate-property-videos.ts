/**
 * Clean up duplicate property_videos
 * Keep only ONE workflow per property (the most recent one)
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

async function cleanup() {
  console.log('🧹 Cleaning up duplicate property_videos...\n');

  // Get all workflows
  const snapshot = await db.collection('property_videos').get();
  console.log(`Total workflows: ${snapshot.size}\n`);

  // Group by propertyId
  const byProperty = new Map<string, any[]>();

  snapshot.forEach(doc => {
    const data = doc.data();
    const propertyId = data.propertyId;

    if (!propertyId) {
      console.log(`⚠️  Workflow ${doc.id} has no propertyId - will be deleted`);
      return;
    }

    if (!byProperty.has(propertyId)) {
      byProperty.set(propertyId, []);
    }

    byProperty.get(propertyId)!.push({
      id: doc.id,
      ...data
    });
  });

  console.log(`Properties with workflows: ${byProperty.size}\n`);

  // Find duplicates
  let totalDuplicates = 0;
  let toDelete: string[] = [];

  byProperty.forEach((workflows, propertyId) => {
    if (workflows.length > 1) {
      // Sort by createdAt (most recent first)
      workflows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Keep the most recent one ONLY if it's pending or processing
      const mostRecent = workflows[0];
      const shouldKeep = ['pending', 'heygen_processing', 'submagic_processing', 'posting'].includes(mostRecent.status);

      if (shouldKeep) {
        // Delete all except the most recent
        const duplicates = workflows.slice(1);
        totalDuplicates += duplicates.length;

        duplicates.forEach(w => {
          toDelete.push(w.id);
        });

        if (duplicates.length > 0) {
          console.log(`Property ${propertyId}: Keeping ${mostRecent.id} (${mostRecent.status}), deleting ${duplicates.length} duplicates`);
        }
      } else {
        // Most recent is completed/failed - delete ALL workflows for this property
        // (they'll be re-added by the sync cron if needed)
        totalDuplicates += workflows.length;
        workflows.forEach(w => toDelete.push(w.id));
        console.log(`Property ${propertyId}: All ${workflows.length} workflows are completed/failed - deleting all`);
      }
    }
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total duplicates to delete: ${toDelete.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (toDelete.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  console.log(`🗑️  Deleting ${toDelete.length} duplicate workflows...`);

  let deleted = 0;
  let failed = 0;

  // Delete in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchIds = toDelete.slice(i, i + BATCH_SIZE);

    batchIds.forEach(id => {
      batch.delete(db.collection('property_videos').doc(id));
    });

    try {
      await batch.commit();
      deleted += batchIds.length;
      console.log(`   Progress: ${deleted}/${toDelete.length}...`);
    } catch (error) {
      console.error(`   ❌ Batch ${i / BATCH_SIZE + 1} failed:`, error);
      failed += batchIds.length;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Deleted: ${deleted} workflows`);
  console.log(`❌ Failed: ${failed} workflows`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

cleanup().catch(console.error);
