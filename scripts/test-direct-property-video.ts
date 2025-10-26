/**
 * Test Property Video Generation Directly (bypassing cron auth)
 * Usage: npx tsx --env-file=.env.local scripts/test-direct-property-video.ts
 */

async function testDirectPropertyVideo() {
  console.log('🏡 Direct Property Video Generation Test\n');
  console.log('='.repeat(70));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Step 1: Get next property from queue
  console.log('\n📊 Step 1: Getting Next Property from Queue...');
  try {
    const response = await fetch(`${baseUrl}/api/property/populate-queue`);
    const data = await response.json();

    if (!data.stats?.nextProperty) {
      console.log('   ⚠️  No properties in queue');
      return;
    }

    const nextProperty = data.stats.nextProperty;
    console.log(`   ✅ Next property: ${nextProperty.address}`);
    console.log(`   Property ID: ${nextProperty.propertyId}`);
    console.log(`   City: ${nextProperty.city}, ${nextProperty.state}`);
    console.log(`   Down Payment: $${nextProperty.downPayment.toLocaleString()}`);

    // Step 2: Generate video for this property
    console.log('\n🎬 Step 2: Generating Video...');

    const genResponse = await fetch(`${baseUrl}/api/property/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        propertyId: nextProperty.propertyId,
        variant: '15'
      })
    });

    const genData = await genResponse.json();

    if (!genResponse.ok) {
      console.error(`   ❌ Failed: ${genResponse.status}`);
      console.error(`   Error: ${JSON.stringify(genData, null, 2)}`);
      if (genData.details && genData.details.length > 0) {
        console.error(`\n   🔍 Validation Errors:`);
        genData.details.forEach((error: string) => {
          console.error(`      - ${error}`);
        });
      }
      return;
    }

    console.log(`   ✅ Video generation started!`);
    console.log(`   Workflow ID: ${genData.workflowId}`);
    console.log(`   HeyGen Video ID: ${genData.videoId}`);
    console.log(`   Property: ${genData.property?.address}`);

    // Step 3: Wait and check workflow status
    console.log('\n⏳ Step 3: Waiting 5 seconds for workflow to save...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔍 Step 4: Checking Workflow Status...');
    const logsResponse = await fetch(`${baseUrl}/api/property/workflows/logs`);
    const logsData = await logsResponse.json();

    if (logsData.success && logsData.workflows) {
      const workflow = logsData.workflows.find((w: any) => w.id === genData.workflowId);

      if (workflow) {
        console.log(`   ✅ Workflow found in database!`);
        console.log(`   Status: ${workflow.status}`);
        console.log(`   Property: ${workflow.address}`);
        console.log(`   City: ${workflow.city}, ${workflow.state}`);
        console.log(`   HeyGen Video ID: ${workflow.heygenVideoId}`);
        console.log(`   Variant: ${workflow.variant || '15sec'}`);
        console.log(`   Created: ${new Date(workflow.createdAt).toLocaleString()}`);

        if (workflow.script) {
          console.log(`\n   📝 Script Preview (first 200 chars):`);
          console.log(`   "${workflow.script.substring(0, 200)}..."`);
        }

        if (workflow.error) {
          console.log(`\n   ⚠️  Error: ${workflow.error}`);
        } else {
          console.log('\n   ✅ No errors detected!');
        }

        console.log('\n   📝 Next Steps:');
        console.log('      1. ⏳ HeyGen processing (5-10 minutes)');
        console.log('      2. 🔔 Webhook → Submagic for captions');
        console.log('      3. 📱 Late.dev posts to social media');
        console.log('\n   💡 Monitor at: https://ownerfi.ai/dashboard/property-videos');
        console.log(`   💡 Workflow ID: ${genData.workflowId}`);

      } else {
        console.log(`   ⚠️  Workflow not found in logs (may need to refresh)`);
      }
    } else {
      console.error(`   ❌ Failed to fetch workflow logs`);
    }

    // Step 5: Mark property as completed in queue
    console.log('\n✅ Step 5: Test Complete!');
    console.log(`   Property "${nextProperty.address}" video is being generated`);
    console.log(`   HeyGen Video ID: ${genData.videoId}`);
    console.log(`   Workflow ID: ${genData.workflowId}`);

  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
    console.error(error);
  }

  console.log('\n' + '='.repeat(70));
}

testDirectPropertyVideo().catch(console.error);
