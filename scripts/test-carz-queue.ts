/**
 * Test Carz brand posting to verify queue usage
 */

import { postToLate } from '../src/lib/late-api';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testCarzQueue() {
  console.log('🧪 Testing Carz brand posting with queue...\n');

  try {
    const result = await postToLate({
      videoUrl: 'https://storage.googleapis.com/ownerfi-95aa0.appspot.com/test-video.mp4', // Test video
      caption: '🚗 TEST POST - Verifying Carz queue usage (will delete)',
      title: 'Test Queue Verification',
      platforms: ['instagram', 'tiktok'], // Just 2 platforms for testing
      brand: 'carz',
      useQueue: true, // ✅ Should use Late.so's queue
      timezone: 'America/Chicago'
    });

    console.log('\n✅ Post Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 SUCCESS!');
      console.log('📋 Late Post ID:', result.postId);
      console.log('\n🔍 Check Late.so dashboard to verify:');
      console.log('   1. Post should be in QUEUE (not scheduled with specific time)');
      console.log('   2. Should show "Queued" status');
      console.log('   3. Should NOT show a specific UTC schedule time');
    } else {
      console.log('\n❌ FAILED:', result.error);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

testCarzQueue();
