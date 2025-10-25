#!/usr/bin/env node

/**
 * Complete workflows by fetching finished videos from Submagic
 * and posting them to Late.so
 */

// Fix for Node.js fetch SSL issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

// The 10 workflows we sent to Submagic
const workflows = [
  { id: 'wf_1761055250789_n42mlxe54', brand: 'carz', submagicId: '4f71a86f-6c9a-4304-94e7-27eeff0ed16e', title: 'Chevy Lineup' },
  { id: 'wf_1761012050828_7cf9xeziq', brand: 'carz', submagicId: 'aa40a0ec-40d9-483e-a290-9bb818e8e694', title: 'Maserati Interior' },
  { id: 'wf_1761001203838_9n6vled53', brand: 'carz', submagicId: '62b8f1b8-2ed1-470d-81da-c4f545685a00', title: 'Dual-Ghia' },
  { id: 'wf_1760993732356_6ina3j47h', brand: 'carz', submagicId: 'fcec22f2-994a-4d8d-96eb-1eebcccb1cfa', title: 'Jeep Liberty' },
  { id: 'wf_1761055255377_k1w6u77a4', brand: 'ownerfi', submagicId: '0b68b563-f2a0-49f4-a901-a46a24e6423d', title: 'Mortgage Data' },
  { id: 'wf_1761012059592_l48q34205', brand: 'ownerfi', submagicId: 'ca1696ec-eb52-4740-bb1e-65bb49c8b5a2', title: 'Sotheby Agents' },
  { id: 'wf_1761001207557_n0p0zatrb', brand: 'ownerfi', submagicId: 'f81c0ca3-a8c2-4468-a2bd-636dc44bd567', title: 'Phoenix Suns' },
  { id: 'wf_1760993735056_1doskoqqv', brand: 'ownerfi', submagicId: 'f6c8fd9f-77bc-4e6b-9bf5-f4857622d92f', title: 'Housing Emergency' },
  { id: 'podcast_1761055210316_3tprpe708', brand: 'podcast', submagicId: '8721dd94-1f71-400d-b542-7219702e0915', title: 'Negotiation Tactics' },
  { id: 'podcast_1760993737581_xmeqaz0wj', brand: 'podcast', submagicId: '89f4ff88-d573-43ed-9674-ceb7cbb28060', title: 'Rental Property' }
];

async function getSubmagicStatus(projectId) {
  try {
    // Get project details which includes download URL
    const getResponse = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
      headers: { 'x-api-key': SUBMAGIC_API_KEY }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      throw new Error(`Submagic API error: ${getResponse.status} - ${errorText}`);
    }

    const projectData = await getResponse.json();

    return {
      status: projectData.status,
      videoUrl: projectData.directUrl || projectData.downloadUrl || projectData.media_url || projectData.video_url,
      thumbnailUrl: projectData.thumbnail_url
    };
  } catch (error) {
    throw error;
  }
}

async function completeWorkflow(workflow) {
  console.log(`\n🔄 Processing: ${workflow.title}`);
  console.log(`   Workflow ID: ${workflow.id}`);
  console.log(`   Submagic ID: ${workflow.submagicId}`);

  try {
    // Step 1: Get Submagic status
    console.log(`   ⏳ Fetching Submagic status...`);
    const submagicStatus = await getSubmagicStatus(workflow.submagicId);

    console.log(`   📊 Submagic status: ${submagicStatus.status}`);

    if (submagicStatus.status !== 'completed' && submagicStatus.status !== 'done') {
      console.log(`   ⚠️  Video not completed yet (status: ${submagicStatus.status})`);
      return false;
    }

    if (!submagicStatus.videoUrl) {
      console.log(`   ❌ No video URL from Submagic`);
      return false;
    }

    console.log(`   ✅ Submagic video URL obtained`);

    // Step 2: Update workflow with finalVideoUrl (required for retry-posting)
    console.log(`   📝 Updating workflow with video URL...`);

    const updateUrl = `${BASE_URL}/api/workflow/update-status`;
    const updatePayload = {
      workflowId: workflow.id,
      brand: workflow.brand,
      updates: {
        finalVideoUrl: submagicStatus.videoUrl,
        submagicDownloadUrl: submagicStatus.videoUrl,
        status: 'posting' // Set to posting so retry knows where to start
      }
    };

    // Try to update (endpoint may not exist, that's ok)
    try {
      await fetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
    } catch (e) {
      // Ignore - will try direct retry
    }

    // Step 3: Retry from posting stage using existing admin endpoint
    console.log(`   📡 Retrying workflow from posting stage...`);

    const retryUrl = `${BASE_URL}/api/admin/retry-workflow`;

    const retryResponse = await fetch(retryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: workflow.id,
        brand: workflow.brand,
        stage: 'posting',
        finalVideoUrl: submagicStatus.videoUrl // Provide URL in case workflow doesn't have it
      })
    });

    if (!retryResponse.ok) {
      const errorText = await retryResponse.text();
      console.log(`   ❌ Failed: ${retryResponse.status} - ${errorText.substring(0, 200)}`);
      return false;
    }

    const result = await retryResponse.json();
    if (result.success) {
      console.log(`   ✅ Posted to social media! Late.so ID: ${result.postId}`);
      return true;
    } else {
      console.log(`   ❌ Retry failed: ${result.error}`);
      return false;
    }

  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 COMPLETE SUBMAGIC WORKFLOWS\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Submagic API Key: ${SUBMAGIC_API_KEY ? '✅ Set' : '❌ Missing'}\n`);
  console.log('=' .repeat(70));

  if (!SUBMAGIC_API_KEY) {
    console.error('\n❌ SUBMAGIC_API_KEY not found!');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const workflow of workflows) {
    const success = await completeWorkflow(workflow);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Wait 2 seconds between workflows
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total workflows: ${workflows.length}`);
  console.log(`   Successfully completed: ${successCount}`);
  console.log(`   Failed/Still processing: ${failCount}\n`);

  if (successCount > 0) {
    console.log('✅ Workflows are being completed and posted to social media!');
    console.log(`📊 Check dashboard: ${BASE_URL}/admin/social-dashboard\n`);
  }
}

main().catch(console.error);
