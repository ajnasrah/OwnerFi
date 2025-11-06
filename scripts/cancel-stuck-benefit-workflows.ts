/**
 * Cancel benefit workflows that are stuck in Submagic processing for >24 hours
 * These workflows have been stuck for 6-7 days and need to be cancelled and retried
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, doc as firestoreDoc, updateDoc } from 'firebase/firestore';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const STUCK_THRESHOLD_HOURS = 24; // Consider stuck if processing for more than 24 hours

async function cancelStuckBenefitWorkflows() {
  console.log('🔄 Cancelling stuck benefit workflows...\n');

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ SUBMAGIC_API_KEY not set');
    return;
  }

  try {
    // Query benefit workflows in submagic_processing status
    const q = query(
      collection(db, 'benefit_workflow_queue'),
      where('status', '==', 'submagic_processing')
    );

    const snapshot = await getDocs(q);
    console.log(`📦 Found ${snapshot.size} benefit workflows in submagic_processing\n`);

    if (snapshot.size === 0) {
      console.log('✅ No workflows to cancel!');
      return;
    }

    const workflowsToCancel: any[] = [];

    // First pass: Identify truly stuck workflows (>24 hours)
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const submagicId = data.submagicVideoId || data.submagicProjectId;
      const timestamp = data.statusChangedAt || data.updatedAt || 0;
      const stuckHours = Math.round((Date.now() - timestamp) / 3600000);

      if (!submagicId) {
        console.log(`⏭️  Skipping ${docSnapshot.id} - no Submagic ID`);
        continue;
      }

      if (stuckHours < STUCK_THRESHOLD_HOURS) {
        console.log(`⏭️  Skipping ${docSnapshot.id} - only stuck for ${stuckHours}h (threshold: ${STUCK_THRESHOLD_HOURS}h)`);
        continue;
      }

      // Check Submagic API status
      try {
        const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        });

        if (response.ok) {
          const submagicData = await response.json();

          // Only cancel if still showing "processing" status
          if (submagicData.status === 'processing') {
            workflowsToCancel.push({
              id: docSnapshot.id,
              data,
              submagicId,
              stuckHours
            });
            console.log(`⚠️  ${docSnapshot.id}: ${data.benefitTitle} - Stuck for ${stuckHours}h, will cancel`);
          } else if (submagicData.status === 'completed' || submagicData.status === 'done' || submagicData.status === 'ready') {
            console.log(`✅ ${docSnapshot.id}: ${data.benefitTitle} - Actually completed! (${submagicData.status})`);
          } else {
            console.log(`📊 ${docSnapshot.id}: ${data.benefitTitle} - Status: ${submagicData.status}`);
          }
        } else if (response.status === 404) {
          // Project already deleted/cancelled on Submagic
          workflowsToCancel.push({
            id: docSnapshot.id,
            data,
            submagicId,
            stuckHours,
            alreadyDeleted: true
          });
          console.log(`🗑️  ${docSnapshot.id}: ${data.benefitTitle} - Already deleted on Submagic, will mark as failed`);
        } else {
          console.log(`❌ ${docSnapshot.id}: API error ${response.status}`);
        }
      } catch (err) {
        console.log(`❌ ${docSnapshot.id}: Error - ${err instanceof Error ? err.message : err}`);
      }
    }

    if (workflowsToCancel.length === 0) {
      console.log('\n⚠️  No workflows need to be cancelled');
      return;
    }

    console.log(`\n🚨 Found ${workflowsToCancel.length} workflows to cancel\n`);

    // Second pass: Cancel workflows
    let cancelled = 0;
    for (const workflow of workflowsToCancel) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Processing: ${workflow.data.benefitTitle}`);
      console.log(`   ID: ${workflow.id}`);
      console.log(`   Stuck for: ${workflow.stuckHours} hours`);
      console.log(`   Submagic ID: ${workflow.submagicId}`);

      try {
        // Cancel on Submagic if not already deleted
        if (!workflow.alreadyDeleted) {
          console.log(`   🗑️  Cancelling on Submagic...`);
          const deleteResponse = await fetch(`https://api.submagic.co/v1/projects/${workflow.submagicId}`, {
            method: 'DELETE',
            headers: { 'x-api-key': SUBMAGIC_API_KEY }
          });

          if (deleteResponse.ok) {
            console.log(`   ✅ Cancelled on Submagic`);
          } else if (deleteResponse.status === 404) {
            console.log(`   ℹ️  Already deleted on Submagic`);
          } else {
            const errorText = await deleteResponse.text();
            console.log(`   ⚠️  Submagic delete failed (${deleteResponse.status}): ${errorText.substring(0, 100)}`);
            // Continue anyway - we'll mark it as failed in Firestore
          }
        }

        // Mark as failed in Firestore with detailed error message
        console.log(`   💾 Marking as failed in Firestore...`);
        await updateDoc(firestoreDoc(db, 'benefit_workflow_queue', workflow.id), {
          status: 'failed',
          error: `Submagic processing stuck for ${workflow.stuckHours} hours. Cancelled and marked for retry.`,
          failedAt: Date.now(),
          updatedAt: Date.now(),
          cancelledFromSubmagic: true,
          previousSubmagicId: workflow.submagicId
        });

        console.log(`   ✅ CANCELLED AND MARKED AS FAILED`);
        cancelled++;
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
      }
    }

    console.log(`\n${'━'.repeat(80)}`);
    console.log(`\n✨ SUMMARY`);
    console.log(`   Total found: ${snapshot.size}`);
    console.log(`   Stuck workflows: ${workflowsToCancel.length}`);
    console.log(`   Successfully cancelled: ${cancelled}`);
    console.log(`\n💡 These workflows are now marked as 'failed' and can be retried manually or automatically`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

cancelStuckBenefitWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
