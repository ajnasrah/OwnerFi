#!/usr/bin/env npx tsx

/**
 * Fix workflows stuck with localhost webhook URLs
 * Re-trigger Submagic export with correct webhook URL
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY!;
const CORRECT_WEBHOOK_URL = 'https://ownerfi.ai/api/webhooks/submagic/abdullah';

async function fixLocalhostWebhooks() {
  console.log('🔍 Finding workflows with localhost webhooks...');

  const response = await fetch('https://ownerfi.ai/api/workflow/logs');
  const data = await response.json();

  const stuckWorkflows = data.workflows.abdullah.filter(
    (w: any) => w.status === 'submagic_processing'
  );

  console.log(`📋 Checking ${stuckWorkflows.length} stuck workflows\n`);

  for (const workflow of stuckWorkflows) {
    console.log(`\n🔄 Workflow: ${workflow.id}`);
    console.log(`   Submagic ID: ${workflow.submagicVideoId}`);

    try {
      // Check Submagic project
      const checkResponse = await fetch(
        `https://api.submagic.co/v1/projects/${workflow.submagicVideoId}`,
        { headers: { 'x-api-key': SUBMAGIC_API_KEY } }
      );

      const projectData = await checkResponse.json();
      console.log(`   Status: ${projectData.status}`);
      console.log(`   Webhook: ${projectData.webhookUrl}`);

      if (projectData.webhookUrl?.includes('localhost')) {
        console.log(`   ❌ Has localhost webhook - triggering export with correct URL...`);

        // Trigger export with correct webhook
        const exportResponse = await fetch(
          `https://api.submagic.co/v1/projects/${workflow.submagicVideoId}/export`,
          {
            method: 'POST',
            headers: {
              'x-api-key': SUBMAGIC_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              webhookUrl: CORRECT_WEBHOOK_URL
            })
          }
        );

        if (exportResponse.ok) {
          console.log(`   ✅ Export triggered with correct webhook!`);
        } else {
          const error = await exportResponse.text();
          console.log(`   ❌ Export failed: ${error}`);
        }
      } else if (projectData.status === 'completed' && projectData.directUrl) {
        console.log(`   ✅ Already completed with good webhook - calling process-video...`);

        const processResponse = await fetch('https://ownerfi.ai/api/process-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: workflow.id,
            brand: 'abdullah',
            submagicProjectId: workflow.submagicVideoId,
            videoUrl: projectData.directUrl
          })
        });

        const result = await processResponse.json();
        console.log(`   Result: ${result.success ? '✅ Recovered' : '❌ ' + result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n\n✅ Done! Webhooks will fire when exports complete.`);
}

fixLocalhostWebhooks().catch(console.error);
