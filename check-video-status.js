// Check the status of generated videos
require('dotenv').config({ path: '.env.local' });

const videoIds = [
  '2763a79119cc49e380be623af6bebf41',
  'd8292417290548348d12f390fb98be68',
  'eb3ef361f93b474baaa732cbb4e39742'
];

async function checkVideos() {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  console.log('Checking video status...\n');

  for (const videoId of videoIds) {
    try {
      const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY
        }
      });

      const data = await response.json();

      console.log(`Video ID: ${videoId}`);
      console.log(`Status: ${data.data.status}`);
      if (data.data.video_url) {
        console.log(`URL: ${data.data.video_url}`);
      }
      console.log();
    } catch (error) {
      console.error(`Error checking ${videoId}:`, error.message);
    }
  }
}

checkVideos();
