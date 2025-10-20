/**
 * Download videos from Submagic and upload to R2
 */

import { config } from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
config({ path: '.env.local' });

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const WORKFLOWS = [
  {
    id: 'wf_1760828445197_y6oxnrtn5',
    brand: 'carz',
    submagicId: 'db8dc481-fa81-476f-99b3-8f4fc8738f64',
    title: '2026 Mercedes-Benz EQE'
  },
  {
    id: 'wf_1760839244657_khc1z13hl',
    brand: 'carz',
    submagicId: '29396756-7a41-4dc9-bb85-e3bd066f5caf',
    title: 'Mitsubishi Teases All-Terrain SUV'
  },
  {
    id: 'wf_1760820968954_2wjjgqu0a',
    brand: 'ownerfi',
    submagicId: '56215707-21bc-41f4-9b17-4c35705563b3',
    title: 'Senior homeowner wealth hits new record'
  },
  {
    id: 'wf_1760828448052_h24n6amot',
    brand: 'ownerfi',
    submagicId: 'b43354da-ffdb-43f2-b96c-15c1f5ad04a0',
    title: '24-year-old agent closed $56 million'
  },
];

async function main() {
  if (!SUBMAGIC_API_KEY) {
    throw new Error('SUBMAGIC_API_KEY not found');
  }

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

  const recovered = [];

  for (const wf of WORKFLOWS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📹 ${wf.brand.toUpperCase()}: ${wf.title}`);
    console.log(`   Workflow ID: ${wf.id}`);
    console.log(`   Submagic ID: ${wf.submagicId}`);

    try {
      // 1. Fetch project details from Submagic
      console.log(`\n   🔍 Fetching from Submagic API...`);
      const projectResponse = await fetch(
        `https://api.submagic.co/v1/projects/${wf.submagicId}`,
        {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        }
      );

      if (!projectResponse.ok) {
        console.error(`   ❌ Submagic API error: ${projectResponse.status}`);
        continue;
      }

      const projectData = await projectResponse.json();
      const downloadUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

      if (!downloadUrl) {
        console.error(`   ❌ No video URL found in Submagic project`);
        console.log(`   Project data:`, JSON.stringify(projectData, null, 2));
        continue;
      }

      console.log(`   ✅ Found video URL: ${downloadUrl.substring(0, 80)}...`);

      // 2. Download video from Submagic
      console.log(`   📥 Downloading video...`);
      const videoResponse = await fetch(downloadUrl);

      if (!videoResponse.ok) {
        console.error(`   ❌ Download failed: ${videoResponse.status}`);
        continue;
      }

      const arrayBuffer = await videoResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const sizeInMB = (buffer.length / 1024 / 1024).toFixed(2);

      console.log(`   ✅ Downloaded ${sizeInMB} MB`);

      // 3. Upload to R2
      console.log(`   ☁️  Uploading to R2...`);
      const fileName = `${wf.brand}/submagic-videos/${wf.id}.mp4`;

      await r2Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: 'video/mp4',
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'source': 'submagic-recovery',
          'workflow-id': wf.id,
          'brand': wf.brand,
        },
      }));

      const videoUrl = publicUrl
        ? `${publicUrl}/${fileName}`
        : `https://pub-${accountId}.r2.dev/${fileName}`;

      console.log(`   ✅ Uploaded to R2: ${videoUrl}`);

      recovered.push({
        workflowId: wf.id,
        brand: wf.brand,
        title: wf.title,
        videoUrl,
        size: sizeInMB
      });

    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
    }
  }

  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📊 RECOVERY SUMMARY: ${recovered.length}/${WORKFLOWS.length} videos recovered\n`);

  if (recovered.length > 0) {
    console.log('✅ Successfully recovered videos:\n');
    recovered.forEach(v => {
      console.log(`   ${v.brand.toUpperCase()}: ${v.title}`);
      console.log(`   Size: ${v.size} MB`);
      console.log(`   URL: ${v.videoUrl}\n`);
    });

    console.log('\n🔧 Next: Update Firestore with these URLs');
    console.log('Run this to update workflows and post to Late:\n');
    console.log(`curl -X POST https://ownerfi.ai/api/admin/recover-workflows \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '${JSON.stringify({ workflows: recovered }, null, 2)}'`);
  }
}

main().catch(console.error);
