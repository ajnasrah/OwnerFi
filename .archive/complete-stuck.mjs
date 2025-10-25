#!/usr/bin/env node
// Complete stuck Submagic workflows directly

import fetch from 'node-fetch';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const WEBHOOK_URL = 'https://ownerfi.ai/api/webhooks/submagic';

if (!SUBMAGIC_API_KEY) {
  console.error('❌ SUBMAGIC_API_KEY not set');
  process.exit(1);
}

// You'll need to provide the Submagic project IDs for the stuck workflows
// Get these from the Firestore or Submagic dashboard
const stuckProjectIds = [
  // Add project IDs here
];

async function completeStuckWorkflow(projectId) {
  console.log(`\n🔍 Checking Submagic project: ${projectId}`);

  // Get project status from Submagic
  const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
    headers: { 'x-api-key': SUBMAGIC_API_KEY }
  });

  if (!response.ok) {
    console.error(`❌ API error: ${response.status}`);
    return;
  }

  const projectData = await response.json();
  const status = projectData.status;
  const downloadUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

  console.log(`   Status: ${status}`);

  if (status === 'completed' || status === 'done' || status === 'ready') {
    if (!downloadUrl) {
      console.log(`   ⚠️  No download URL found`);
      return;
    }

    console.log(`   ✅ Video complete! Triggering webhook...`);

    // Manually trigger webhook
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projectId,
        id: projectId,
        status: 'completed',
        downloadUrl: downloadUrl,
        media_url: downloadUrl,
        timestamp: new Date().toISOString()
      })
    });

    const webhookResult = await webhookResponse.json();
    console.log(`   ✅ Webhook triggered:`, webhookResult);
  } else {
    console.log(`   ⏳ Still processing (${status})`);
  }
}

async function main() {
  console.log('🚀 Completing stuck Submagic workflows...\n');

  if (stuckProjectIds.length === 0) {
    console.log('ℹ️  No project IDs provided.');
    console.log('   Add Submagic project IDs to the stuckProjectIds array in this script.');
    process.exit(0);
  }

  for (const projectId of stuckProjectIds) {
    await completeStuckWorkflow(projectId);
  }

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
