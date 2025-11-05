// Download and check video dimensions
const fs = require('fs');
const https = require('https');

const VIDEO_URL = 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/ff32a8615c294f7fa1e27f414115f79b.mp4?Expires=1760815244&Signature=hiI26SfTfEU7XUfkFR-reTfLGLiwC6Xzcj-ynlA1IbWU5YsWSfLIcEnz9rWRE6UrJVajdNXt0D98uOkF94dYs8DKPs9nT1Hk0cFCbPpGWI3XbV4pU7kKbhSoLnpd0qufbL-pptj0714AfSUXQEdA~N15UAngTrX4dH7KwSofpq2zk9GKjwnC1gJ5qbSNsLtefXhx-uVv3LOms8Rcr3GgUmjMOHW4eJH8WF0hrbR0nLHNzWQTb5h60sBJsKI13-ahVkzesupMEzqZkEX0tR17e2wyYyX-zZw~CyQAaqVyQJsjK40zECrRKIlpGrGDWXZL~W6ysbYibhvXzGUJ-FaKBg__&Key-Pair-Id=K38HBHX5LX3X2H';

async function downloadVideo() {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream('test_video.mp4');

    https.get(VIDEO_URL, (response) => {
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('✅ Video downloaded successfully!');
        console.log('📁 Saved as: test_video.mp4');
        console.log(`📦 File size: ${fs.statSync('test_video.mp4').size} bytes`);
        console.log('\n🎥 You can now open the video to check its dimensions');
        console.log('   or use: ffmpeg -i test_video.mp4');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink('test_video.mp4', () => {});
      reject(err);
    });
  });
}

downloadVideo();
