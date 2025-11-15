#!/usr/bin/env ts-node
/**
 * Delete ALL workflows from propertyShowcaseWorkflows collection
 * USE WITH CAUTION - this will delete all data
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const adminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

const app = initializeApp(adminConfig);
const db = getFirestore(app);

async function deleteAllWorkflows() {
  console.log('🗑️  DELETE ALL PROPERTY WORKFLOWS');
  console.log('=' .repeat(60));
  console.log('⚠️  WARNING: This will delete ALL workflows from propertyShowcaseWorkflows');
  console.log('=' .repeat(60));

  try {
    // Get all workflows
    const snapshot = await db.collection('propertyShowcaseWorkflows').get();

    if (snapshot.empty) {
      console.log('✅ Collection is already empty');
      return;
    }

    console.log(`\n📊 Found ${snapshot.size} workflows to delete\n`);

    // Show breakdown by status
    const statusCounts: Record<string, number> = {};
    const queueStatusCounts: Record<string, number> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      statusCounts[data.status] = (statusCounts[data.status] || 0) + 1;
      queueStatusCounts[data.queueStatus] = (queueStatusCounts[data.queueStatus] || 0) + 1;
    });

    console.log('📋 Breakdown by workflow status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n📋 Breakdown by queue status:');
    Object.entries(queueStatusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n🔥 Deleting all workflows...');

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, Math.min(i + batchSize, snapshot.docs.length));

      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`   Deleted ${deletedCount}/${snapshot.size}...`);
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} workflows`);
    console.log('🏁 Collection is now empty');

    // Verify deletion
    const verifySnapshot = await db.collection('propertyShowcaseWorkflows').get();
    console.log(`\n✅ Verification: Collection now has ${verifySnapshot.size} documents`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

deleteAllWorkflows()
  .then(() => {
    console.log('\n🎉 Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
