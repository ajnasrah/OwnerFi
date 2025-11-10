/**
 * Recover benefit workflows that are stuck in submagic_processing
 * but are actually completed on Submagic's end
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, doc as firestoreDoc, updateDoc } from 'firebase/firestore';
import { getBenefitById, generateBenefitCaption, generateBenefitTitle } from '../src/lib/benefit-content';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const MAX_TO_RECOVER = 5; // Process max 5 at a time to avoid timeout

async function recoverBenefitWorkflows() {
  console.log('🔄 Recovering benefit workflows...\n');

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
      console.log('✅ No workflows to recover!');
      return;
    }

    const workflowsToRecover: any[] = [];

    // First pass: Check which workflows are ready
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const submagicId = data.submagicVideoId || data.submagicProjectId;

      if (!submagicId) {
        console.log(`⏭️  Skipping ${docSnapshot.id} - no Submagic ID`);
        continue;
      }

      // Check Submagic API status
      try {
        const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        });

        if (response.ok) {
          const submagicData = await response.json();
          const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl;

          if ((submagicData.status === 'completed' || submagicData.status === 'done' || submagicData.status === 'ready') && downloadUrl) {
            workflowsToRecover.push({
              id: docSnapshot.id,
              data,
              submagicId,
              downloadUrl
            });
            console.log(`✅ ${docSnapshot.id}: ${data.benefitTitle} - READY`);
          } else {
            console.log(`⏳ ${docSnapshot.id}: ${data.benefitTitle} - Still processing (${submagicData.status})`);
          }
        } else {
          console.log(`❌ ${docSnapshot.id}: API error ${response.status}`);
        }
      } catch (err) {
        console.log(`❌ ${docSnapshot.id}: Error - ${err instanceof Error ? err.message : err}`);
      }
    }

    if (workflowsToRecover.length === 0) {
      console.log('\n⚠️  No workflows are ready for recovery');
      return;
    }

    console.log(`\n🚀 Recovering ${Math.min(workflowsToRecover.length, MAX_TO_RECOVER)} workflows...\n`);

    // Second pass: Recover workflows
    let recovered = 0;
    for (const workflow of workflowsToRecover.slice(0, MAX_TO_RECOVER)) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Processing: ${workflow.data.benefitTitle}`);
      console.log(`   ID: ${workflow.id}`);

      try {
        // 1. Upload to R2
        console.log(`   ☁️  Uploading to R2...`);
        const { uploadSubmagicVideo } = await import('../src/lib/video-storage');
        const publicVideoUrl = await uploadSubmagicVideo(workflow.downloadUrl);
        console.log(`   ✅ R2 upload complete`);

        // 2. Update status to 'posting'
        console.log(`   💾 Updating status to 'posting'...`);
        await updateDoc(firestoreDoc(db, 'benefit_workflow_queue', workflow.id), {
          status: 'posting',
          finalVideoUrl: publicVideoUrl,
          submagicDownloadUrl: workflow.downloadUrl,
          updatedAt: Date.now()
        });

        // 3. Generate caption and title if missing
        let caption = workflow.data.caption;
        let title = workflow.data.title;

        if (!caption || !title) {
          console.log(`   📝 Generating caption and title from benefit data...`);
          const benefitId = workflow.data.benefitId;
          if (benefitId) {
            const benefit = getBenefitById(benefitId);
            if (benefit) {
              caption = caption || generateBenefitCaption(benefit);
              title = title || generateBenefitTitle(benefit);
              console.log(`   ✅ Generated from benefit: ${benefit.title}`);
            }
          }

          // Final fallback
          if (!caption) {
            caption = 'Learn about owner financing! 🏡';
            console.log(`   ⚠️  Using generic fallback caption`);
          }
          if (!title) {
            title = workflow.data.benefitTitle || 'Owner Finance Benefits';
          }
        }

        // 4. Post to Late
        console.log(`   📱 Posting to Late...`);
        const { postToLate } = await import('../src/lib/late-api');

        const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads'];

        const postResult = await postToLate({
          videoUrl: publicVideoUrl,
          caption,
          title,
          platforms: allPlatforms as any[],
          useQueue: false,
          brand: 'benefit'
        });

        if (postResult.success) {
          console.log(`   ✅ Posted to Late!`);

          // 5. Mark as completed and save caption/title
          await updateDoc(firestoreDoc(db, 'benefit_workflow_queue', workflow.id), {
            status: 'completed',
            finalVideoUrl: publicVideoUrl,
            latePostId: postResult.postId,
            caption, // Save the generated caption
            title,   // Save the generated title
            completedAt: Date.now(),
            updatedAt: Date.now()
          });

          console.log(`   🎉 COMPLETED!`);
          recovered++;
        } else {
          throw new Error(`Late posting failed: ${postResult.error}`);
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);

        // Mark as failed
        try {
          await updateDoc(firestoreDoc(db, 'benefit_workflow_queue', workflow.id), {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: Date.now(),
            updatedAt: Date.now()
          });
        } catch (updateError) {
          console.error(`   ❌ Failed to mark as failed: ${updateError}`);
        }
      }
    }

    console.log(`\n${'━'.repeat(80)}`);
    console.log(`\n✨ SUMMARY`);
    console.log(`   Total found: ${snapshot.size}`);
    console.log(`   Ready to recover: ${workflowsToRecover.length}`);
    console.log(`   Successfully recovered: ${recovered}`);
    console.log(`   Remaining: ${workflowsToRecover.length - recovered}`);

    if (workflowsToRecover.length > MAX_TO_RECOVER) {
      console.log(`\n💡 Run this script again to recover the remaining ${workflowsToRecover.length - MAX_TO_RECOVER} workflows`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

recoverBenefitWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
