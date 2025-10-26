/**
 * Test Property Video Generation End-to-End
 * Usage: npx tsx --env-file=.env.local scripts/test-property-video-generation.ts
 */

async function testPropertyVideoGeneration() {
  console.log('🏡 Testing Property Video Generation\n');
  console.log('='.repeat(70));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const cronSecret = process.env.CRON_SECRET;

  // Step 1: Check queue status
  console.log('\n📊 Step 1: Checking Property Queue...');
  try {
    const response = await fetch(`${baseUrl}/api/property/populate-queue`);
    const data = await response.json();

    console.log(`   Total properties: ${data.stats?.total || 0}`);
    console.log(`   Queued: ${data.stats?.queued || 0}`);
    console.log(`   Next property: ${data.stats?.nextProperty?.address || 'None'}`);

    if (data.stats?.queued === 0) {
      console.log('\n   ⚠️  Queue is empty. Properties will be recycled.');
    }
  } catch (error) {
    console.error(`   ❌ Failed: ${error}`);
    return;
  }

  // Step 2: Trigger video generation
  console.log('\n🎬 Step 2: Triggering Property Video Generation...');
  console.log('   (This will generate a video for the next property in queue)\n');

  try {
    const response = await fetch(`${baseUrl}/api/property/video-cron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`   ❌ Failed: ${response.status}`);
      console.error(`   Error: ${JSON.stringify(data, null, 2)}`);
      return;
    }

    console.log(`   ✅ Success: ${data.success}`);
    console.log(`   Variant: ${data.variant || 'N/A'}`);
    console.log(`   Generated: ${data.generated} video(s)`);

    if (data.property) {
      console.log('\n   📍 Property Details:');
      console.log(`      Address: ${data.property.address || 'N/A'}`);
      console.log(`      Property ID: ${data.property.propertyId || 'N/A'}`);
      console.log(`      Workflow ID: ${data.property.workflowId || 'N/A'}`);
      console.log(`      Success: ${data.property.success}`);

      if (data.property.error) {
        console.log(`      Error: ${data.property.error}`);
      }
    }

    if (data.queueStats) {
      console.log('\n   📊 Queue Status After Generation:');
      console.log(`      Queued: ${data.queueStats.queued}`);
      console.log(`      Processing: ${data.queueStats.processing}`);
      console.log(`      Total: ${data.queueStats.total}`);
    }

    // If successful, check workflow status
    if (data.property?.success && data.property?.workflowId) {
      const workflowId = data.property.workflowId;

      console.log(`\n🔍 Step 3: Checking Workflow Status (${workflowId})...`);

      // Wait a few seconds for workflow to be saved
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const logsResponse = await fetch(`${baseUrl}/api/property/workflows/logs`);
        const logsData = await logsResponse.json();

        if (logsData.success && logsData.workflows) {
          const workflow = logsData.workflows.find((w: any) => w.id === workflowId);

          if (workflow) {
            console.log(`   ✅ Workflow found!`);
            console.log(`      Status: ${workflow.status}`);
            console.log(`      Property: ${workflow.address}`);
            console.log(`      HeyGen Video ID: ${workflow.heygenVideoId || 'Pending...'}`);
            console.log(`      Created: ${new Date(workflow.createdAt).toLocaleString()}`);

            if (workflow.error) {
              console.log(`      ⚠️  Error: ${workflow.error}`);
            }

            console.log('\n   📝 Next Steps:');
            console.log('      1. HeyGen will process the video (5-10 minutes)');
            console.log('      2. Webhook will trigger Submagic for captions');
            console.log('      3. Late.dev will post to social media');
            console.log('\n   💡 Monitor progress at: https://ownerfi.ai/dashboard/property-videos');
          } else {
            console.log(`   ⚠️  Workflow not found in logs yet (may take a moment)`);
          }
        }
      } catch (error) {
        console.error(`   ❌ Failed to check workflow: ${error}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test complete!\n');

  } catch (error) {
    console.error(`   ❌ Failed: ${error}`);
  }
}

testPropertyVideoGeneration().catch(console.error);
