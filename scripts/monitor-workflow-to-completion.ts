/**
 * Monitor workflow from HeyGen → Submagic → Late.dev → Social Media
 */

const WORKFLOW_ID = 'property_15sec_1761445132537_l7582';
const HEYGEN_VIDEO_ID = '0bd8a97fb42840aeb00914e09ccf05e3';

async function monitorWorkflow() {
  console.log('🎬 Monitoring Property Video Workflow A-Z\n');
  console.log('='.repeat(70));
  console.log(`\nWorkflow ID: ${WORKFLOW_ID}`);
  console.log(`HeyGen Video ID: ${HEYGEN_VIDEO_ID}`);
  console.log(`Property: 1207 Ocean Blvd. S #50805, Myrtle Beach, SC\n`);
  console.log('='.repeat(70));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let lastStatus = '';
  let checkCount = 0;
  const maxChecks = 60; // Check for up to 30 minutes (30 second intervals)

  while (checkCount < maxChecks) {
    checkCount++;

    try {
      // Check workflow status
      const response = await fetch(`${baseUrl}/api/property/workflows/logs`);
      const data = await response.json();

      if (!data.success || !data.workflows) {
        console.log(`\n⚠️  Failed to fetch workflows`);
        await sleep(30000);
        continue;
      }

      const workflow = data.workflows.find((w: any) => w.id === WORKFLOW_ID);

      if (!workflow) {
        console.log(`\n⚠️  Workflow not found yet...`);
        await sleep(30000);
        continue;
      }

      // Status changed - log update
      if (workflow.status !== lastStatus) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n[${timestamp}] 📊 Status: ${workflow.status}`);

        switch (workflow.status) {
          case 'heygen_processing':
            console.log('   ⏳ HeyGen is generating the video...');
            console.log('   💡 This usually takes 5-10 minutes');
            break;

          case 'heygen_completed':
            console.log('   ✅ HeyGen video completed!');
            console.log(`   🎬 Video URL: ${workflow.heygenVideoUrl || 'N/A'}`);
            console.log(`   ☁️  R2 URL: ${workflow.heygenVideoR2Url || 'N/A'}`);
            break;

          case 'submagic_processing':
            console.log('   ✨ Submagic is adding captions...');
            console.log(`   📦 Project ID: ${workflow.submagicProjectId || workflow.submagicVideoId || 'N/A'}`);
            break;

          case 'submagic_completed':
            console.log('   ✅ Submagic captions completed!');
            console.log(`   🎬 Captioned video URL: ${workflow.submagicVideoUrl || 'N/A'}`);
            break;

          case 'posting':
            console.log('   📱 Late.dev is posting to social media...');
            break;

          case 'completed':
            console.log('   🎉 WORKFLOW COMPLETE!');
            console.log('\n   📊 Final Status:');
            console.log(`      HeyGen Video: ${workflow.heygenVideoUrl ? '✅' : '❌'}`);
            console.log(`      Submagic Video: ${workflow.submagicVideoUrl ? '✅' : '❌'}`);
            console.log(`      Late Post ID: ${workflow.latePostId || 'N/A'}`);
            console.log(`      Platforms: ${workflow.platformsPosted?.join(', ') || 'N/A'}`);

            if (workflow.latePostId) {
              console.log(`\n   🔗 View post on Late.dev: https://app.getlate.so/posts/${workflow.latePostId}`);
            }

            console.log('\n' + '='.repeat(70));
            console.log('✅ Property video posted successfully to social media!');
            console.log('='.repeat(70));
            return;

          case 'failed':
            console.log('   ❌ Workflow failed!');
            console.log(`   Error: ${workflow.error || 'Unknown error'}`);
            console.log('\n' + '='.repeat(70));
            console.log('❌ Workflow failed - check logs for details');
            console.log('='.repeat(70));
            return;
        }

        lastStatus = workflow.status;
      } else {
        // Same status - just show a dot to indicate we're still checking
        process.stdout.write('.');
      }

    } catch (error) {
      console.log(`\n⚠️  Error checking status: ${error}`);
    }

    // Wait 30 seconds before next check
    await sleep(30000);
  }

  console.log('\n\n⏱️  Monitoring timeout reached (30 minutes)');
  console.log('The workflow may still be processing. Check the dashboard for updates.');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

monitorWorkflow().catch(console.error);
