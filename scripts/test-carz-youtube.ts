import * as dotenv from 'dotenv';
import { postVideoToYouTube } from '../src/lib/youtube-api';

dotenv.config({ path: '.env.local' });

async function testCarzUpload() {
  console.log('🧪 Testing Carz YouTube Upload\n');

  const result = await postVideoToYouTube(
    'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/abdullah/submagic-videos/wf_1763823630751_cq59q52ma.mp4',
    'Test - Carz Brand',
    'Test upload for Carz brand #Shorts',
    'carz',
    { privacy: 'unlisted', isShort: true }
  );

  if (result.success) {
    console.log('✅ Carz upload successful!');
    console.log('Video URL:', result.videoUrl);
  } else {
    console.log('❌ Carz upload failed:', result.error);
  }
}

testCarzUpload();
