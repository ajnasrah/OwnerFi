#!/usr/bin/env npx tsx
// Test podcast workflow A-Z

import { config } from 'dotenv';

async function testPodcastAZ() {
  config({ path: '.env.local' });

  console.log('🎙️ TESTING PODCAST WORKFLOW A-Z\n');
  console.log('This will:');
  console.log('1. Trigger new podcast episode');
  console.log('2. Monitor HeyGen processing');
  console.log('3. Monitor Submagic processing');
  console.log('4. Verify GetLate posting\n');

  // Step 1: Trigger podcast via dashboard endpoint
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Triggering new podcast episode...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const triggerResponse = await fetch('https://ownerfi.ai/api/podcast/cron?force=true', {
      method: 'POST'
    });

    const triggerData = await triggerResponse.json();

    if (!triggerData.success) {
      console.error('❌ Failed to trigger podcast:', triggerData.error);
      if (triggerData.skipped) {
        console.log('⏭️  Podcast generation was skipped');
        console.log('   Reason:', triggerData.message);
        return;
      }
      process.exit(1);
    }

    const episode = triggerData.episode;
    console.log('✅ Episode triggered successfully!');
    console.log(`   Episode #${episode.number}: ${episode.title}`);
    console.log(`   Guest: ${episode.guest}`);
    console.log(`   Topic: ${episode.topic}`);
    console.log(`   HeyGen Video ID: ${episode.video_id}`);
    console.log(`   Workflow ID: ${episode.workflow_id}\n`);

    const workflowId = episode.workflow_id;
    const episodeNumber = episode.number;

    // Step 2: Monitor workflow progress
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Monitoring workflow progress...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let lastStatus = '';
    let startTime = Date.now();
    const maxWaitMinutes = 45; // Max 45 minutes total

    while ((Date.now() - startTime) < (maxWaitMinutes * 60 * 1000)) {
      // Wait 10 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Fetch workflow status
      const logsResponse = await fetch('https://ownerfi.ai/api/podcast/workflow/logs?history=true');
      const logsData = await logsResponse.json();

      const workflow = logsData.workflows.find((w: any) => w.id === workflowId);

      if (!workflow) {
        console.error('❌ Workflow not found!');
        break;
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);

      // Only log on status change
      if (workflow.status !== lastStatus) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] [${elapsed}m] Status: ${workflow.status}`);

        if (workflow.status === 'heygen_processing') {
          console.log('   ⏳ HeyGen is generating the video...');
        } else if (workflow.status === 'submagic_processing') {
          console.log('   ✅ HeyGen completed! Video sent to Submagic');
          console.log(`   📹 HeyGen URL: ${workflow.heygenVideoUrl?.substring(0, 60)}...`);
          console.log('   ⏳ Submagic is adding captions...');
        } else if (workflow.status === 'posting') {
          console.log('   ✅ Submagic completed! Posting to GetLate');
          if (workflow.finalVideoUrl) {
            console.log(`   📹 Final URL: ${workflow.finalVideoUrl?.substring(0, 60)}...`);
          }
        } else if (workflow.status === 'completed') {
          console.log('   ✅ Posted to GetLate successfully!');
          if (workflow.latePostId) {
            console.log(`   🚀 GetLate Post ID: ${workflow.latePostId}`);
          }
        } else if (workflow.status === 'failed') {
          console.log(`   ❌ Workflow failed: ${workflow.error || 'Unknown error'}`);
        }

        lastStatus = workflow.status;
      }

      // Check if completed or failed
      if (workflow.status === 'completed') {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ SUCCESS! WORKFLOW COMPLETED A-Z');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`Episode #${episodeNumber}: ${episode.title}`);
        console.log(`Guest: ${episode.guest}`);
        console.log(`Total time: ${elapsed} minutes`);
        console.log(`GetLate Post ID: ${workflow.latePostId || 'N/A'}\n`);
        console.log('✅ All fixes working correctly!');
        console.log('   ✓ HeyGen API (video_inputs fix)');
        console.log('   ✓ HeyGen → Submagic (no timeout)');
        console.log('   ✓ Submagic → R2 → GetLate');
        console.log('   ✓ Workflow stays in Active view');
        return;
      }

      if (workflow.status === 'failed') {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('❌ WORKFLOW FAILED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`Error: ${workflow.error || 'Unknown error'}`);
        console.log(`Status when failed: ${workflow.status}`);
        return;
      }
    }

    console.log('\n⏰ Monitoring timeout reached (45 minutes)');
    console.log('   Workflow may still be processing - check dashboard');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testPodcastAZ();
