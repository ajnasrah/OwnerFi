#!/usr/bin/env npx tsx
// Manually complete Dr. Smith podcast workflow

import { config } from 'dotenv';
import { writeFileSync } from 'fs';

async function completeWorkflow() {
  console.log('🎬 Completing Dr. Smith Podcast Workflow\n');

  try {
    config({ path: '.env.local' });

    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    const projectId = '5a0d8ab2-fb87-42f7-a9fa-923ad65708b3';

    if (!SUBMAGIC_API_KEY) {
      console.error('❌ SUBMAGIC_API_KEY not found');
      process.exit(1);
    }

    // Get the completed video details
    console.log('📥 Fetching completed video from Submagic...');
    const response = await fetch(
      `https://api.submagic.co/v1/projects/${projectId}`,
      { headers: { 'x-api-key': SUBMAGIC_API_KEY } }
    );

    const data = await response.json();
    console.log(`Status: ${data.status}`);

    if (data.status !== 'completed') {
      console.error('❌ Video is not completed yet');
      process.exit(1);
    }

    const videoUrl = data.directUrl || data.downloadUrl;
    console.log(`✅ Video URL: ${videoUrl}\n`);

    // Trigger the webhook manually
    console.log('📡 Triggering Submagic webhook for podcast...');

    const webhookPayload = {
      id: projectId,
      status: 'completed',
      title: data.title,
      directUrl: videoUrl,
      downloadUrl: data.downloadUrl,
      duration: data.videoMetaData?.duration,
      _manual_trigger: true
    };

    console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    const webhookResponse = await fetch(
      'https://ownerfi.ai/api/webhooks/submagic-podcast',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      }
    );

    console.log(`\nWebhook response: ${webhookResponse.status} ${webhookResponse.statusText}`);

    const webhookData = await webhookResponse.json();
    console.log('Response:', JSON.stringify(webhookData, null, 2));

    if (webhookData.success) {
      console.log('\n✅ SUCCESS! Workflow completed and posted to GetLate!');
      if (webhookData.latePostId) {
        console.log(`   GetLate Post ID: ${webhookData.latePostId}`);
      }
    } else {
      console.error('\n❌ Webhook failed:', webhookData.error);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

completeWorkflow();
