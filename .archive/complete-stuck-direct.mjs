#!/usr/bin/env node
// Manual script to complete stuck workflows by directly calling Metricool API
// Bypasses webhook system entirely to avoid cached code

import { config } from 'dotenv';
config({ path: '.env.local' });

const WORKFLOWS = [
  {
    workflowId: 'wf_1760457868526_hk4dxnk8o',
    brand: 'carz',
    submagicId: '41fb93e2-9319-4d96-9032-bd31c4cd1c5b',
    title: 'World\'s first autonomous, hydrogen farm tractor debuts in Kubota orange',
    caption: 'Check out this video! 🔥'
  }
  // Second workflow removed - Submagic video expired (404)
];

const METRICOOL_BASE_URL = 'https://app.metricool.com/api/v2';
const METRICOOL_API_KEY = process.env.METRICOOL_API_KEY;
const METRICOOL_USER_ID = process.env.METRICOOL_USER_ID;
const METRICOOL_CARZ_BRAND_ID = process.env.METRICOOL_CARZ_BRAND_ID;
const METRICOOL_OWNERFI_BRAND_ID = process.env.METRICOOL_OWNERFI_BRAND_ID;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

async function getSubmagicVideoUrl(projectId) {
  console.log(`   Fetching video URL from Submagic for ${projectId}...`);
  const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
    headers: { 'x-api-key': SUBMAGIC_API_KEY }
  });

  if (!response.ok) {
    throw new Error(`Submagic API error: ${response.status}`);
  }

  const data = await response.json();
  const videoUrl = data.media_url || data.video_url || data.downloadUrl;

  if (!videoUrl) {
    throw new Error('No video URL in Submagic response');
  }

  console.log(`   ✅ Got video URL: ${videoUrl.substring(0, 50)}...`);
  return videoUrl;
}

async function postToMetricool(workflow, videoUrl) {
  const brandId = workflow.brand === 'carz' ? METRICOOL_CARZ_BRAND_ID : METRICOOL_OWNERFI_BRAND_ID;
  const brandName = workflow.brand === 'carz' ? 'Carz Inc' : 'OwnerFi';

  console.log(`\n📱 Posting ${workflow.title.substring(0, 50)}... to Metricool (${brandName})...`);

  // POST 1: Reels/Shorts
  const reelsPlatforms = ['facebook', 'instagram', 'tiktok', 'linkedin', 'threads', 'twitter', 'youtube'];

  const scheduleDate = new Date(Date.now() + 60000); // 1 minute from now
  const publicationDate = scheduleDate.toISOString().replace(/\.\d{3}Z$/, '');

  const requestBody = {
    text: workflow.caption,
    providers: reelsPlatforms.map(platform => ({ network: platform })),
    media: [videoUrl],
    publicationDate: {
      dateTime: publicationDate,
      timezone: 'America/New_York'
    },
    instagramData: { type: 'REEL' },
    facebookData: { type: 'REEL' },
    youtubeData: {
      title: workflow.title,
      privacy: 'PUBLIC',
      madeForKids: false,
      category: workflow.brand === 'carz' ? 'AUTOS_VEHICLES' : 'NEWS_POLITICS',
      type: 'SHORT'
    },
    tiktokData: { privacyOption: 'PUBLIC_TO_EVERYONE' }
    // NO threadsData - visibility field not supported
    // NO linkedinData - visibility field not supported
  };

  console.log('   Posting reels/shorts...');

  const response = await fetch(
    `${METRICOOL_BASE_URL}/scheduler/posts?blogId=${brandId}&userId=${METRICOOL_USER_ID}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mc-Auth': METRICOOL_API_KEY
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`   ❌ Metricool API error: ${response.status}`);
    console.error(`   Response: ${errorText}`);
    throw new Error(`Metricool API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`   ✅ Reels/Shorts posted! Post ID: ${data.data?.id || data.id}`);

  // POST 2: Stories
  console.log('   Posting stories...');
  const storiesBody = {
    text: workflow.caption,
    providers: [
      { network: 'instagram' },
      { network: 'facebook' }
    ],
    media: [videoUrl],
    publicationDate: {
      dateTime: publicationDate,
      timezone: 'America/New_York'
    },
    instagramData: { type: 'STORY' },
    facebookData: { type: 'STORY' }
  };

  const storiesResponse = await fetch(
    `${METRICOOL_BASE_URL}/scheduler/posts?blogId=${brandId}&userId=${METRICOOL_USER_ID}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mc-Auth': METRICOOL_API_KEY
      },
      body: JSON.stringify(storiesBody)
    }
  );

  if (storiesResponse.ok) {
    const storiesData = await storiesResponse.json();
    console.log(`   ✅ Stories posted! Post ID: ${storiesData.data?.id || storiesData.id}`);
  } else {
    const errorText = await storiesResponse.text();
    console.log(`   ⚠️  Stories failed: ${storiesResponse.status} - ${errorText}`);
  }

  return data.data?.id || data.id;
}

async function completeWorkflow(workflow) {
  try {
    console.log(`\n========================================`);
    console.log(`Processing: ${workflow.title}`);
    console.log(`Brand: ${workflow.brand.toUpperCase()}`);
    console.log(`Workflow ID: ${workflow.workflowId}`);
    console.log(`Submagic ID: ${workflow.submagicId}`);

    // Step 1: Get video URL from Submagic
    const videoUrl = await getSubmagicVideoUrl(workflow.submagicId);

    // Step 2: Post to Metricool (with fixed LinkedIn config - NO linkedinData!)
    const postId = await postToMetricool(workflow, videoUrl);

    console.log(`\n✅ Workflow completed! Post ID: ${postId}`);
    console.log(`   The workflow should now show as completed in the dashboard.`);
    return true;

  } catch (error) {
    console.error(`\n❌ Error completing workflow:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Manual Workflow Completion Script');
  console.log('=====================================');
  console.log('This script directly calls Metricool API to bypass webhook caching\n');

  if (!METRICOOL_API_KEY || !METRICOOL_USER_ID) {
    console.error('❌ Missing Metricool credentials (METRICOOL_API_KEY, METRICOOL_USER_ID)');
    process.exit(1);
  }

  if (!METRICOOL_CARZ_BRAND_ID || !METRICOOL_OWNERFI_BRAND_ID) {
    console.error('❌ Missing brand IDs (METRICOOL_CARZ_BRAND_ID, METRICOOL_OWNERFI_BRAND_ID)');
    process.exit(1);
  }

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ Missing Submagic API key (SUBMAGIC_API_KEY)');
    process.exit(1);
  }

  console.log('✅ All credentials found\n');

  let successCount = 0;
  let failCount = 0;

  for (const workflow of WORKFLOWS) {
    const success = await completeWorkflow(workflow);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    // Wait 2 seconds between workflows
    if (workflow !== WORKFLOWS[WORKFLOWS.length - 1]) {
      console.log('\nWaiting 2 seconds before next workflow...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n========================================');
  console.log(`✅ Script complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log('========================================\n');
}

main().catch(console.error);
