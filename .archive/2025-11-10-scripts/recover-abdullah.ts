/**
 * Recover Abdullah workflows stuck at video_processing
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
if (!SUBMAGIC_API_KEY) {
  throw new Error('SUBMAGIC_API_KEY not configured');
}

async function recoverAbdullahWorkflows() {
  console.log('🔧 Recovering Abdullah workflows stuck at video_processing...\n');

  const q = query(
    collection(db, 'abdullah_workflow_queue'),
    where('status', '==', 'video_processing')
  );

  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.size} Abdullah workflows stuck at video_processing\n`);

  for (const docSnapshot of snapshot.docs) {
    const workflow = docSnapshot.data();
    const workflowId = docSnapshot.id;
    const submagicId = workflow.submagicProjectId || workflow.submagicVideoId;

    console.log(`\n🔍 Checking ${workflowId}`);
    console.log(`   Title: ${workflow.contentTitle || 'N/A'}`);
    console.log(`   Submagic ID: ${submagicId || 'MISSING'}`);
    console.log(`   Created: ${new Date(workflow.createdAt).toLocaleString()}`);

    if (!submagicId) {
      console.log(`   ⚠️  No Submagic ID - checking if it has video URL...`);

      if (workflow.submagicDownloadUrl || workflow.finalVideoUrl) {
        console.log(`   ✅ Has video URL - triggering process-video...`);

        const videoUrl = workflow.finalVideoUrl || workflow.submagicDownloadUrl;
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ownerfi.ai';

        try {
          const response = await fetch(`${baseUrl}/api/process-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brand: 'abdullah',
              workflowId,
              videoUrl
            })
          });

          const data = await response.json();

          if (response.ok && data.success) {
            console.log(`   ✅ Recovered!`);
          } else {
            console.error(`   ❌ Failed: ${data.error}`);
          }
        } catch (error) {
          console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
        }
      } else {
        console.log(`   ❌ No video URL - cannot recover`);
      }
      continue;
    }

    // Check Submagic status
    try {
      const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
        headers: { 'x-api-key': SUBMAGIC_API_KEY }
      });

      if (!response.ok) {
        console.error(`   ❌ Submagic API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const status = data.status;
      const downloadUrl = data.media_url || data.video_url || data.downloadUrl || data.directUrl;

      console.log(`   Submagic Status: ${status}`);
      console.log(`   Download URL: ${downloadUrl ? 'EXISTS' : 'MISSING'}`);

      if (status === 'completed' && downloadUrl) {
        console.log(`   ✅ Video ready - triggering process-video...`);

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ownerfi.ai';

        const processResponse = await fetch(`${baseUrl}/api/process-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: 'abdullah',
            workflowId,
            videoUrl: downloadUrl,
            submagicProjectId: submagicId
          })
        });

        const processData = await processResponse.json();

        if (processResponse.ok && processData.success) {
          console.log(`   ✅ Recovered!`);
          console.log(`   Post IDs: ${processData.postIds}`);
        } else {
          console.error(`   ❌ Failed: ${processData.error}`);
        }
      } else if (status === 'completed' && !downloadUrl) {
        console.log(`   ⚠️  Completed but no download URL - triggering export...`);

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ownerfi.ai';
        const webhookUrl = `${baseUrl}/api/webhooks/submagic/abdullah`;

        const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${submagicId}/export`, {
          method: 'POST',
          headers: {
            'x-api-key': SUBMAGIC_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhookUrl,
            format: 'mp4',
            quality: 'high'
          })
        });

        if (exportResponse.ok) {
          console.log(`   ✅ Export triggered - webhook will fire when complete`);
        } else {
          const errorText = await exportResponse.text();
          console.error(`   ❌ Export failed:`, errorText);
        }
      } else {
        console.log(`   ⏳ Still processing (${status})`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
    }

    // Wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Done!');
}

recoverAbdullahWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
