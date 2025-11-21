import * as dotenv from 'dotenv';
import { postToLate } from '../src/lib/late-api';

dotenv.config({ path: '.env.local' });

async function testAbdullahPosting() {
  console.log('🧪 Testing Abdullah brand posting to Late.dev');
  console.log('');

  const testCaption = 'Test post from debug script - please ignore';
  const testVideoUrl = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/abdullah/submagic-videos/wf_1763737207410_5u0n1zpft.mp4';

  try {
    console.log('Posting to Late.dev with:');
    console.log('  Brand: abdullah');
    console.log('  Use Queue: true');
    console.log('  Platforms: instagram, tiktok, youtube, facebook, linkedin');
    console.log('');

    const result = await postToLate({
      videoUrl: testVideoUrl,
      caption: testCaption,
      title: 'Debug Test Post',
      platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'],
      brand: 'abdullah',
      useQueue: true,
      timezone: 'America/Chicago'
    });

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success && result.postId) {
      console.log('');
      console.log('✅ Post created successfully!');
      console.log('Post ID:', result.postId);

      // Now fetch it back to verify
      const LATE_API_KEY = process.env.LATE_API_KEY;
      console.log('');
      console.log('Verifying post exists...');

      const verifyResponse = await fetch(`https://getlate.dev/api/v1/posts/${result.postId}`, {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (verifyResponse.ok) {
        const postData = await verifyResponse.json();
        console.log('✅ Post verified!');
        console.log('Profile from post:', postData.post?.queuedFromProfile);
        console.log('Expected profile: 68f02bc0b9cd4f90fdb3ec86');
        console.log('Match:', postData.post?.queuedFromProfile === '68f02bc0b9cd4f90fdb3ec86');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAbdullahPosting();
