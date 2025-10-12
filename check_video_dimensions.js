// Script to check video dimensions after it's complete
const HEYGEN_API_KEY = 'MzQxYjQyYzZlOTk1NGQ3OWJiZjhlNWMxODMxOGE5YzItMTc1OTc5OTgyMA==';
const VIDEO_ID = 'ff32a8615c294f7fa1e27f414115f79b';

async function checkVideoStatus() {
  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${VIDEO_ID}`, {
    headers: {
      'x-api-key': HEYGEN_API_KEY
    }
  });

  const data = await response.json();
  const status = data.data.status;

  console.log(`\nVideo Status: ${status}`);

  if (status === 'completed') {
    console.log('\n✅ Video is ready!');
    console.log('Video URL:', data.data.video_url);
    console.log('Thumbnail:', data.data.thumbnail_url);
    console.log('Duration:', data.data.duration, 'seconds');
    console.log('\nDownload the video and check its dimensions with:');
    console.log(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 video.mp4`);
    return true;
  } else if (status === 'failed') {
    console.log('\n❌ Video generation failed');
    console.log('Error:', data.data.error);
    return true;
  } else {
    console.log('Still processing... checking again in 5 seconds');
    return false;
  }
}

async function monitor() {
  let done = false;
  while (!done) {
    done = await checkVideoStatus();
    if (!done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

monitor();
