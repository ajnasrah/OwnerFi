/**
 * List all videos in R2 bucket
 * Helps diagnose what's actually stored vs what workflows expect
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listR2Videos() {
  console.log('📦 Listing R2 Bucket Contents\n');

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'ownerfi-podcast-videos';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ R2 credentials not configured');
    process.exit(1);
  }

  const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');

  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log(`🔍 Bucket: ${bucketName}`);
  console.log(`🌐 Public URL: ${process.env.R2_PUBLIC_URL}\n`);

  // List abdullah folder specifically
  console.log('📂 Checking /abdullah folder:');
  const abdullahList = await r2Client.send(new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: 'abdullah/'
  }));

  const abdullahObjects = abdullahList.Contents || [];
  console.log(`   Found ${abdullahObjects.length} objects\n`);

  if (abdullahObjects.length > 0) {
    console.log('   Files:');
    abdullahObjects.forEach(obj => {
      const sizeKB = ((obj.Size || 0) / 1024).toFixed(2);
      const age = obj.LastModified
        ? `${Math.round((Date.now() - obj.LastModified.getTime()) / (1000 * 60 * 60))}h ago`
        : 'unknown';
      console.log(`   - ${obj.Key} (${sizeKB} KB, ${age})`);
    });
  } else {
    console.log('   ⚠️  No files found in abdullah/ folder!');
  }

  // List all objects
  console.log('\n📂 Full bucket contents:');
  const fullList = await r2Client.send(new ListObjectsV2Command({
    Bucket: bucketName
  }));

  const allObjects = fullList.Contents || [];
  console.log(`   Total objects: ${allObjects.length}\n`);

  // Group by folder
  const byFolder: Record<string, number> = {};
  allObjects.forEach(obj => {
    const folder = obj.Key?.split('/')[0] || 'root';
    byFolder[folder] = (byFolder[folder] || 0) + 1;
  });

  console.log('   By folder:');
  Object.entries(byFolder)
    .sort(([, a], [, b]) => b - a)
    .forEach(([folder, count]) => {
      console.log(`   - ${folder}: ${count} files`);
    });

  // Show recent uploads
  console.log('\n📅 Recent uploads (last 24h):');
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const recentObjects = allObjects
    .filter(obj => obj.LastModified && obj.LastModified.getTime() > oneDayAgo)
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

  if (recentObjects.length > 0) {
    recentObjects.slice(0, 10).forEach(obj => {
      const sizeKB = ((obj.Size || 0) / 1024).toFixed(2);
      const age = obj.LastModified
        ? `${Math.round((Date.now() - obj.LastModified.getTime()) / (1000 * 60))}m ago`
        : 'unknown';
      console.log(`   - ${obj.Key} (${sizeKB} KB, ${age})`);
    });
  } else {
    console.log('   No uploads in last 24 hours');
  }

  console.log('\n✅ Done');
}

listR2Videos().catch(error => {
  console.error('💥 Error:', error);
  process.exit(1);
});
