/**
 * List R2 Videos
 *
 * Lists all videos in the R2 bucket
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

async function listR2Videos() {
  console.log('📦 Listing R2 Bucket Videos...\n');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    console.error('❌ R2 credentials not configured');
    process.exit(1);
  }

  try {
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      MaxKeys: 20
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      console.log('📭 No videos found in R2 bucket');
      return;
    }

    console.log(`✅ Found ${response.Contents.length} videos:\n`);

    // Sort by LastModified (newest first)
    const sortedVideos = response.Contents.sort((a, b) =>
      b.LastModified.getTime() - a.LastModified.getTime()
    );

    sortedVideos.forEach((obj, index) => {
      const publicUrl = `${R2_PUBLIC_URL}/${obj.Key}`;
      const sizeInMB = (obj.Size / 1024 / 1024).toFixed(2);
      const date = obj.LastModified.toLocaleString();

      console.log(`${index + 1}. ${obj.Key}`);
      console.log(`   URL: ${publicUrl}`);
      console.log(`   Size: ${sizeInMB} MB`);
      console.log(`   Date: ${date}`);
      console.log();
    });

    const latestVideo = sortedVideos[0];
    const latestUrl = `${R2_PUBLIC_URL}/${latestVideo.Key}`;

    console.log('🎬 Latest video URL:');
    console.log(`   ${latestUrl}\n`);

    console.log('📋 To test with Late API, run:');
    console.log(`   node test-late-r2.js "${latestUrl}"\n`);

  } catch (error) {
    console.error('❌ Error listing R2 videos:', error.message);
    process.exit(1);
  }
}

listR2Videos();
