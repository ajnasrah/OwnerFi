/**
 * Recover Video URLs for Stuck Workflows
 *
 * This script:
 * 1. Lists files in R2 storage for each stuck workflow
 * 2. Constructs public URLs for found videos
 * 3. Updates Firestore workflows with recovered URLs
 * 4. Retries Late API posting
 */

import { config } from 'dotenv';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';

// Load environment variables from .env.local
config({ path: '.env.local' });

const STUCK_WORKFLOWS = [
  { id: 'wf_1760828445197_y6oxnrtn5', brand: 'carz' },
  { id: 'wf_1760839244657_khc1z13hl', brand: 'carz' },
  { id: 'wf_1760820968954_2wjjgqu0a', brand: 'ownerfi' },
  { id: 'wf_1760828448052_h24n6amot', brand: 'ownerfi' },
];

async function main() {
  console.log('🔍 Searching for stuck workflow videos in R2...\n');

  // Initialize R2 client
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'ownerfi-podcast-videos';
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }

  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const recoveredVideos = [];

  for (const workflow of STUCK_WORKFLOWS) {
    const expectedPath = `${workflow.brand}/submagic-videos/${workflow.id}.mp4`;
    console.log(`📂 Checking: ${expectedPath}`);

    try {
      // Check if file exists in R2
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: expectedPath,
      });

      const response = await r2Client.send(headCommand);

      // File exists! Construct public URL
      const videoUrl = publicUrl
        ? `${publicUrl}/${expectedPath}`
        : `https://pub-${accountId}.r2.dev/${expectedPath}`;

      const sizeInMB = ((response.ContentLength || 0) / 1024 / 1024).toFixed(2);

      console.log(`   ✅ FOUND! ${sizeInMB} MB`);
      console.log(`   📹 URL: ${videoUrl}`);

      recoveredVideos.push({
        workflowId: workflow.id,
        brand: workflow.brand,
        videoUrl,
        size: sizeInMB,
      });

    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log(`   ❌ Not found in R2`);
      } else {
        console.error(`   ❌ Error:`, error.message);
      }
    }

    console.log('');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 SUMMARY: Found ${recoveredVideos.length}/${STUCK_WORKFLOWS.length} videos\n`);

  if (recoveredVideos.length > 0) {
    console.log('🎬 Recovered Videos:');
    recoveredVideos.forEach(v => {
      console.log(`\n   ${v.brand.toUpperCase()}: ${v.workflowId}`);
      console.log(`   Size: ${v.size} MB`);
      console.log(`   URL: ${v.videoUrl}`);
    });

    console.log('\n\n🔧 Next Steps:\n');
    console.log('Update Firestore with these URLs:');
    recoveredVideos.forEach(v => {
      console.log(`\ncurl -X POST https://ownerfi.ai/api/debug/update-workflow \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{`);
      console.log(`    "workflowId": "${v.workflowId}",`);
      console.log(`    "brand": "${v.brand}",`);
      console.log(`    "finalVideoUrl": "${v.videoUrl}"`);
      console.log(`  }'`);
    });
  } else {
    console.log('❌ No videos found in R2 storage.');
    console.log('\nPossible reasons:');
    console.log('1. Videos were never uploaded (failed before R2 upload)');
    console.log('2. Videos were already deleted by cleanup cron');
    console.log('3. Different storage path or bucket');
  }
}

main().catch(console.error);
