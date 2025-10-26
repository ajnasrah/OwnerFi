#!/usr/bin/env npx tsx
// Manually trigger Submagic for stuck Episode #3

import { config } from 'dotenv';

async function fixEpisode3() {
  console.log('🔧 Fixing Episode #4: Mike Thompson on Trade-in Value Maximization\n');

  try {
    config({ path: '.env.local' });

    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

    // Episode #4 - Mike Thompson
    const workflowId = 'podcast_1761449336098_qtl2ic83q';
    const videoUrl = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/podcast/heygen-videos/podcast_1761449336098_qtl2ic83q.mp4';
    const title = 'Mike Thompson on Trade-in Value Maximization';

    if (!SUBMAGIC_API_KEY) {
      console.error('❌ SUBMAGIC_API_KEY not found');
      process.exit(1);
    }

    console.log(`Workflow ID: ${workflowId}`);
    console.log(`Video URL: ${videoUrl}`);
    console.log(`Title: ${title}\n`);

    // Submit to Submagic
    console.log('📤 Submitting to Submagic API...');
    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        language: 'en',
        videoUrl,
        templateName: 'Hormozi 2',
        magicBrolls: true,
        magicBrollsPercentage: 50,
        magicZooms: true,
        webhookUrl: 'https://ownerfi.ai/api/webhooks/submagic/podcast'
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Submagic API error:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    const projectId = data?.id || data?.project_id || data?.projectId;

    console.log('Response:', JSON.stringify(data, null, 2));

    if (!projectId) {
      console.error('\n❌ No project ID in response!');
      process.exit(1);
    }

    console.log(`\n✅ Submagic project created: ${projectId}`);

    // Now update the workflow in Firestore
    console.log('\n📝 Updating workflow in Firestore...');

    const updateResponse = await fetch('https://ownerfi.ai/api/podcast/workflow/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflowId,
        updates: {
          status: 'submagic_processing',
          submagicProjectId: projectId,
          submagicVideoId: projectId
        }
      })
    });

    if (updateResponse.ok) {
      console.log('✅ Workflow updated successfully!');
      console.log('\n📊 Monitor at: https://ownerfi.ai/admin/social-dashboard');
      console.log(`   Submagic project: https://app.submagic.co/view/${projectId}`);
    } else {
      console.error('❌ Failed to update workflow:', await updateResponse.text());
      console.log('\nℹ️  Submagic is processing, but workflow status not updated in Firestore');
      console.log(`   You may need to manually update the workflow or wait for the webhook`);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

fixEpisode3();
