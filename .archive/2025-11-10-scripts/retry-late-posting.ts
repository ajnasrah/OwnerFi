/**
 * Manually retry Late API posting for a stuck workflow
 * This will show us the actual error
 */

import { postToLate } from '../src/lib/late-api';

const WORKFLOW_ID = 'wf_1762188576931_hkarrk702'; // Carz workflow stuck at posting
const VIDEO_URL = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/viral-videos/submagic-1762200023407-kc2cxs.mp4';

async function retryPosting() {
  console.log('🔄 Retrying Late API posting...');
  console.log(`   Workflow: ${WORKFLOW_ID}`);
  console.log(`   Video: ${VIDEO_URL}\n`);

  const result = await postToLate({
    videoUrl: VIDEO_URL,
    caption: 'Test post to diagnose Late API failures',
    title: 'Test Video',
    platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
    brand: 'carz',
    useQueue: false,
  });

  console.log('\n📊 Result:');
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    console.log('\n❌ POSTING FAILED');
    console.log(`Error: ${result.error}`);
  } else {
    console.log('\n✅ POSTING SUCCEEDED');
    console.log(`Post ID: ${result.postId}`);
  }
}

retryPosting().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
