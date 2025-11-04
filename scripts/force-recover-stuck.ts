#!/usr/bin/env npx tsx

/**
 * Force recovery of stuck workflows
 * Bypasses the broken cron and directly processes stuck workflows
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY!;

async function recoverStuckWorkflows() {
  console.log('🔍 Fetching stuck workflows...');

  // Get stuck workflows
  const response = await fetch('https://ownerfi.ai/api/workflow/logs');
  const data = await response.json();

  const stuckWorkflows = data.workflows.abdullah.filter(
    (w: any) => w.status === 'submagic_processing'
  );

  console.log(`📋 Found ${stuckWorkflows.length} stuck workflows\n`);

  let recovered = 0;
  let failed = 0;

  for (const workflow of stuckWorkflows.slice(0, 10)) {
    console.log(`\n🔄 Processing workflow: ${workflow.id}`);
    console.log(`   Submagic ID: ${workflow.submagicVideoId}`);

    try {
      // Check Submagic status
      const submagicResponse = await fetch(
        `https://api.submagic.co/v1/projects/${workflow.submagicVideoId}`,
        { headers: { 'x-api-key': SUBMAGIC_API_KEY } }
      );

      const submagicData = await submagicResponse.json();
      console.log(`   Status: ${submagicData.status}`);

      if (submagicData.status === 'completed' && submagicData.directUrl) {
        console.log(`   ✅ Video ready! Calling process-video endpoint...`);

        // Call process-video endpoint
        const processResponse = await fetch('https://ownerfi.ai/api/process-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflow.id,
            brand: 'abdullah',
            submagicProjectId: workflow.submagicVideoId,
            videoUrl: submagicData.directUrl
          })
        });

        const processResult = await processResponse.json();

        if (processResult.success) {
          console.log(`   ✅ Recovered successfully!`);
          recovered++;
        } else {
          console.log(`   ❌ Failed: ${processResult.error}`);
          failed++;
        }
      } else {
        console.log(`   ⏳ Still processing, skipping...`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   ✅ Recovered: ${recovered}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏳ Still processing: ${stuckWorkflows.length - recovered - failed}`);
}

recoverStuckWorkflows().catch(console.error);
