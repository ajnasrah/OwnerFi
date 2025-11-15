#!/usr/bin/env npx tsx

/**
 * Test Spanish Video Generation
 * Triggers a Spanish property video and posts to GetLate queue
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

async function testSpanishVideo() {
  console.log('🇪🇸 Testing Spanish Video Generation Pipeline\n');

  try {
    // Import the property video service
    const { generatePropertyVideo } = await import('../src/lib/property-video-service');
    const { getNextPropertyFromRotation } = await import('../src/lib/feed-store-firestore');

    // Get next property from queue
    console.log('📋 Fetching next property from queue...');
    const queueItem = await getNextPropertyFromRotation();

    if (!queueItem) {
      console.error('❌ No properties in queue');
      return;
    }

    console.log(`✅ Found property: ${queueItem.address}, ${queueItem.city}, ${queueItem.state}`);
    console.log(`   Property ID: ${queueItem.propertyId}\n`);

    // Generate Spanish video (15 seconds)
    console.log('🎬 Generating Spanish property video (15 sec)...');
    const result = await generatePropertyVideo(queueItem.propertyId, '15', 'es');

    console.log('\n✅ Spanish Video Workflow Started!');
    console.log('   Workflow ID:', result.workflowId);
    console.log('   Property:', result.property.address);
    console.log('   Language: Spanish (es)');
    console.log('   Duration: 15 seconds');
    console.log('\n📝 Script Preview:');
    console.log(result.script?.slice(0, 200) + '...');
    console.log('\n🎯 Next Steps:');
    console.log('   1. HeyGen will generate avatar video');
    console.log('   2. Webhook will trigger Submagic for Spanish captions');
    console.log('   3. Final video will be posted to GetLate queue');
    console.log(`\n🔗 Webhook URL: ${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/heygen/property-spanish`);

    return result;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
testSpanishVideo()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
