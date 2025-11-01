/**
 * EMERGENCY RECOVERY: Fix all properties stuck in 'posting' without video URL
 *
 * This script:
 * 1. Finds all property_videos with status='posting' and no finalVideoUrl
 * 2. Reverts them to status='submagic_processing'
 * 3. Lets check-stuck-submagic cron retry the Submagic download → R2 upload → Late posting
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function recoverStuckProperties() {
  console.log('🚨 EMERGENCY RECOVERY: Fixing stuck property workflows\n');

  // Find all properties stuck in 'posting' status
  const q = query(
    collection(db, 'property_videos'),
    where('status', '==', 'posting')
  );

  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.size} workflows in 'posting' status\n`);

  let recoveredCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    const workflowId = docSnapshot.id;

    console.log(`\n📄 Workflow: ${workflowId}`);
    console.log(`   Property: ${data.address}, ${data.city}, ${data.state}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Final Video URL: ${data.finalVideoUrl ? 'Present ✅' : 'MISSING ❌'}`);
    console.log(`   Submagic Project ID: ${data.submagicProjectId || 'MISSING'}`);

    // Only recover workflows that are missing finalVideoUrl
    if (!data.finalVideoUrl) {
      const submagicProjectId = data.submagicProjectId || data.submagicVideoId;

      if (submagicProjectId) {
        console.log(`   🔄 Reverting to submagic_processing for retry...`);

        try {
          // Just update status - don't try to delete error field
          await updateDoc(doc(db, 'property_videos', workflowId), {
            status: 'submagic_processing',
            recoveredAt: Date.now(),
            recoveryReason: 'Stuck in posting without video URL - reverted for retry',
            updatedAt: Date.now()
          });

          console.log(`   ✅ RECOVERED - check-stuck-submagic will retry this workflow`);
          recoveredCount++;
        } catch (err) {
          console.error(`   ❌ Failed to update:`, err);
          failedCount++;
        }
      } else {
        console.log(`   ⚠️  SKIPPED - No Submagic project ID (cannot recover)`);
        skippedCount++;
      }
    } else {
      console.log(`   ✅ Has video URL - will retry Late posting via check-stuck-posting cron`);
      skippedCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 RECOVERY SUMMARY:');
  console.log(`   Total workflows found: ${snapshot.size}`);
  console.log(`   ✅ Recovered (reverted to submagic_processing): ${recoveredCount}`);
  console.log(`   ⏭️  Skipped (has video URL or no Submagic ID): ${skippedCount}`);
  console.log(`   ❌ Failed to update: ${failedCount}`);
  console.log('='.repeat(80));

  if (recoveredCount > 0) {
    console.log('\n🎯 NEXT STEPS:');
    console.log('   1. Wait for check-stuck-submagic cron to run (runs every 15 min)');
    console.log('   2. OR manually trigger: GET /api/cron/check-stuck-submagic');
    console.log('   3. Monitor logs to see workflows complete');
    console.log('   4. Check social media dashboard to verify posting\n');
  }
}

recoverStuckProperties()
  .then(() => {
    console.log('\n✅ Recovery script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Recovery script failed:', err);
    process.exit(1);
  });
