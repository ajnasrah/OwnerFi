import { config } from 'dotenv';

config({ path: '.env.local' });

const heygenIds = [
  'f78abf2ae08b4e099910ba072a68c230',
  'd92bd29452714ae7bce924dd316bbd0d',
  '8389678f71364ea083d7ecf2f574b260',
  'edee5dae00e441c0bc07103885c3a62d',
  'de07e5aa48cf43a287a9a0599bc9cc04',
  'c0243bc9cb4245a49d4c8e6d91c0f394',
  '2603a5cea5624ae78f4ddacb16714674',
  'ef03411ac3694b72847155629c00121d',
  '82011b605877400dabaa769b43225f7b',
  '9a13cb7210fb4b65b397f8c1e9d3fcd4'
];

async function checkHeyGenStatus(videoId: string) {
  const url = `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY || ''
      }
    });

    const data = await response.json();
    return { videoId, status: data.data?.status, error: data.error, data: data.data };
  } catch (error: any) {
    return { videoId, error: error.message };
  }
}

async function main() {
  console.log('🔍 Checking HeyGen status for 10 stuck Abdullah workflows\n');

  for (const videoId of heygenIds) {
    const result = await checkHeyGenStatus(videoId);
    console.log(`\n📹 Video ID: ${result.videoId}`);
    console.log(`   Status: ${result.status || 'ERROR'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.data?.video_url) {
      console.log(`   Video URL: ${result.data.video_url}`);
    }
    if (result.data?.duration) {
      console.log(`   Duration: ${result.data.duration}s`);
    }
  }

  console.log('\n✅ Done checking HeyGen statuses\n');
}

main();
