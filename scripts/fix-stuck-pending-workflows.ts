/**
 * Fix Stuck Pending Workflows
 *
 * This script identifies workflows stuck in "Pending" status and either:
 * 1. Retries them if they have no HeyGen video ID
 * 2. Advances them if they have a HeyGen video ID but are stuck
 * 3. Marks them as failed if they're too old (> 24 hours)
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function fixStuckPendingWorkflows() {
  console.log('🔍 Finding stuck Pending workflows...\n');

  const adminDb = await getAdminDb();

  if (!adminDb) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    console.error('Make sure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set');
    return;
  }
  const brands = ['carz', 'ownerfi', 'vassdistro'];
  const now = Date.now();
  const ONE_HOUR_AGO = now - (1 * 60 * 60 * 1000);
  const ONE_DAY_AGO = now - (24 * 60 * 60 * 1000);

  let totalFixed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const brand of brands) {
    console.log(`\n=== ${brand.toUpperCase()} ===\n`);

    const collectionName = `${brand}_workflow_queue`;

    // First, let's see what status values actually exist
    const allSnapshot = await adminDb
      .collection(collectionName)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    console.log(`Found ${allSnapshot.size} total recent workflows`);
    const statusCounts: Record<string, number> = {};

    allSnapshot.docs.forEach(doc => {
      const status = doc.data().status || 'undefined';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('Status breakdown:', statusCounts);

    const snapshot = await adminDb
      .collection(collectionName)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    console.log(`Found ${snapshot.size} "pending" workflows (lowercase)`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const workflowId = doc.id;
      const createdAt = data.createdAt || 0;
      const ageMs = now - createdAt;
      const ageMinutes = Math.floor(ageMs / 60000);

      console.log(`\nWorkflow: ${workflowId}`);
      console.log(`  Title: ${data.title || data.articleTitle}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Age: ${ageMinutes} minutes`);
      console.log(`  HeyGen Video ID: ${data.heygenVideoId || 'none'}`);

      // If workflow is less than 5 minutes old, skip it (might still be processing)
      if (ageMs < 5 * 60 * 1000) {
        console.log(`  ⏩ SKIPPED: Too recent (< 5 minutes)`);
        totalSkipped++;
        continue;
      }

      // If workflow is older than 24 hours, mark as failed
      if (createdAt < ONE_DAY_AGO) {
        console.log(`  ❌ MARKING AS FAILED: Too old (> 24 hours)`);
        await adminDb.collection(collectionName).doc(workflowId).update({
          status: 'failed',
          error: 'Workflow stuck in Pending for > 24 hours (auto-failed by cleanup script)',
          failedAt: now,
          updatedAt: now
        });
        totalFailed++;
        continue;
      }

      // If workflow has a HeyGen video ID but is stuck, advance it
      if (data.heygenVideoId) {
        console.log(`  ✅ ADVANCING: Has HeyGen video ID, moving to heygen_processing`);
        await adminDb.collection(collectionName).doc(workflowId).update({
          status: 'heygen_processing',
          updatedAt: now
        });
        totalFixed++;
        continue;
      }

      // If workflow is older than 1 hour with no HeyGen ID, retry by calling complete-viral again
      if (createdAt < ONE_HOUR_AGO && !data.heygenVideoId) {
        console.log(`  🔄 MARKING FOR RETRY: No HeyGen video ID after 1 hour`);

        // Mark as failed so it gets unlocked
        await adminDb.collection(collectionName).doc(workflowId).update({
          status: 'failed',
          error: 'Workflow stuck in Pending with no HeyGen video ID (marked for article retry)',
          failedAt: now,
          updatedAt: now
        });

        // Also unlock the article so it can be retried
        if (data.articleId) {
          try {
            const articlesCollection = `${brand}_articles`;
            await adminDb.collection(articlesCollection).doc(data.articleId).update({
              processed: false,
              workflowId: null,
              processedAt: null,
              updatedAt: now
            });
            console.log(`  📰 UNLOCKED: Article ${data.articleId} can now be retried`);
          } catch (err) {
            console.log(`  ⚠️  Could not unlock article: ${err}`);
          }
        }

        totalFailed++;
        continue;
      }

      console.log(`  ⏳ WAITING: Still within 1 hour grace period`);
      totalSkipped++;
    }
  }

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`✅ Fixed (advanced): ${totalFixed}`);
  console.log(`❌ Failed (too old or no progress): ${totalFailed}`);
  console.log(`⏩ Skipped (too recent or waiting): ${totalSkipped}`);
  console.log(`\nTotal processed: ${totalFixed + totalFailed + totalSkipped}`);
}

fixStuckPendingWorkflows().catch(console.error);
