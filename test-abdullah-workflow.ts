/**
 * Test Abdullah Complete Workflow
 * This will create 1 REAL VIDEO end-to-end:
 * 1. Generate script
 * 2. Create HeyGen video
 * 3. Wait for webhooks to process
 * 4. Verify it posts to Late.so
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testCompleteWorkflow() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 TESTING ABDULLAH COMPLETE WORKFLOW (END-TO-END)');
  console.log('='.repeat(70) + '\n');

  console.log('⚠️  WARNING: This will create a REAL video and may incur costs:');
  console.log('   - OpenAI: ~$0.01');
  console.log('   - HeyGen: ~$0.50');
  console.log('   - Submagic: ~$1.00');
  console.log('   Total: ~$1.50');
  console.log();

  // Check required environment variables
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'HEYGEN_API_KEY',
    'LATE_ABDULLAH_PROFILE_ID',
  ];

  console.log('🔍 Checking environment variables...');
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ All required environment variables found');
  console.log();

  // Step 1: Generate 1 script
  console.log('📝 Step 1: Generating 1 test script...');
  const { generateAbdullahDailyContent } = await import('./src/lib/abdullah-content-generator');

  const result = await generateAbdullahDailyContent(process.env.OPENAI_API_KEY!, new Date());
  const script = result.videos[0];

  console.log(`✅ Generated script: "${script.title}"`);
  console.log(`   Theme: ${script.theme}`);
  console.log(`   Word count: ${script.script.split(' ').length} words`);
  console.log();

  // Step 2: Create workflow (this will generate HeyGen video)
  console.log('🎥 Step 2: Triggering workflow (will create HeyGen video)...');
  console.log('   This will:');
  console.log('   - Create workflow queue item in Firestore');
  console.log('   - Generate HeyGen video (~2-5 minutes)');
  console.log('   - HeyGen webhook will trigger Submagic');
  console.log('   - Submagic webhook will post to Late.so');
  console.log();

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${BASE_URL}/api/workflow/complete-abdullah`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platforms: ['instagram'], // Test with just Instagram
        schedule: 'immediate', // Post immediately (no scheduling)
        testMode: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Workflow failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log('✅ Workflow triggered successfully!');
    console.log();
    console.log('='.repeat(70));
    console.log('📊 WORKFLOW DETAILS');
    console.log('='.repeat(70));
    console.log();
    console.log(`Success: ${data.success}`);
    console.log(`Videos generated: ${data.videos?.length || 0}`);
    console.log();

    if (data.videos && data.videos.length > 0) {
      const video = data.videos[0];
      console.log(`Video 1:`);
      console.log(`  Theme: ${video.theme}`);
      console.log(`  Title: ${video.title}`);
      console.log(`  Workflow ID: ${video.workflowId}`);
      console.log(`  HeyGen Video ID: ${video.heygenVideoId}`);
      console.log(`  Status: ${video.status}`);
      console.log();

      console.log('='.repeat(70));
      console.log('⏳ NEXT STEPS');
      console.log('='.repeat(70));
      console.log();
      console.log('The workflow is now running in the background:');
      console.log();
      console.log('1. HeyGen is generating the video (~2-5 minutes)');
      console.log('2. When complete, webhook will upload to R2');
      console.log('3. Then send to Submagic for captions (~3-5 minutes)');
      console.log('4. When complete, webhook will post to Late.so');
      console.log('5. Total time: ~5-10 minutes');
      console.log();
      console.log('Monitor progress:');
      console.log(`  Dashboard: https://ownerfi.ai/admin/social-dashboard`);
      console.log(`  Workflow ID: ${video.workflowId}`);
      console.log();
      console.log('Check status with:');
      console.log(`  curl "https://ownerfi.ai/api/workflow/logs?workflowId=${video.workflowId}"`);
      console.log();

      // Return the workflow ID for monitoring
      return {
        success: true,
        workflowId: video.workflowId,
        heygenVideoId: video.heygenVideoId
      };
    } else {
      throw new Error('No videos were generated');
    }

  } catch (error) {
    console.error('❌ Workflow test failed:', error);
    throw error;
  }
}

testCompleteWorkflow()
  .then(result => {
    console.log('='.repeat(70));
    console.log('✅ TEST STARTED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log();
    console.log('The video is now being processed in the background.');
    console.log('Check the dashboard to monitor progress!');
    console.log();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ TEST FAILED:', error);
    console.error(error.stack);
    process.exit(1);
  });
