/**
 * Emergency fix script for Abdullah workflows
 * Directly fetches HeyGen videos and triggers Submagic processing
 * Bypasses API limitations for Abdullah/Podcast/Benefit brands
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY!;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY!;

// R2 Configuration
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

interface WorkflowData {
  id: string;
  status: string;
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  submagicProjectId?: string;
  title?: string;
  brand: string;
}

async function fetchHeyGenVideoUrl(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      {
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY,
        },
      }
    );

    const data = await response.json() as any;

    if (data.data?.status === 'completed' && data.data?.video_url) {
      return data.data.video_url;
    }

    console.log(`   ⚠️  HeyGen video ${videoId} status: ${data.data?.status || 'unknown'}`);
    return null;
  } catch (error) {
    console.error(`   ❌ Error fetching HeyGen video ${videoId}:`, error);
    return null;
  }
}

async function downloadAndUploadToR2(videoUrl: string, workflowId: string): Promise<string | null> {
  try {
    console.log(`   📥 Downloading video from HeyGen...`);
    const response = await fetch(videoUrl);

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const key = `videos/${workflowId}.mp4`;

    console.log(`   ☁️  Uploading to R2 storage...`);
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
      })
    );

    const permanentUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    console.log(`   ✅ Uploaded to R2: ${permanentUrl}`);
    return permanentUrl;
  } catch (error) {
    console.error(`   ❌ Error uploading to R2:`, error);
    return null;
  }
}

async function triggerSubmagic(videoUrl: string, title: string, workflowId: string): Promise<string | null> {
  try {
    console.log(`   🎬 Triggering Submagic processing...`);

    // Use abdullah brand webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai'}/api/webhooks/submagic/abdullah`;

    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SUBMAGIC_API_KEY,
      },
      body: JSON.stringify({
        title: title.substring(0, 50),
        language: 'en',
        videoUrl: videoUrl,
        webhookUrl: webhookUrl,
        templateName: 'Hormozi 2',
        magicZooms: true,
        magicBrolls: true,
        magicBrollsPercentage: 75,
        removeSilencePace: 'fast',
        removeBadTakes: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Submagic API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json() as any;
    const projectId = data?.id || data?.project_id || data?.projectId || data?.data?.id;

    if (projectId) {
      console.log(`   ✅ Submagic project created: ${projectId}`);
      return projectId;
    }

    console.error(`   ❌ No project ID in response:`, data);
    return null;
  } catch (error) {
    console.error(`   ❌ Error triggering Submagic:`, error);
    return null;
  }
}

async function fixStuckHeyGenWorkflows(brand: string): Promise<number> {
  console.log(`\n🔧 Processing stuck HeyGen workflows for ${brand}...`);

  const workflows = await db
    .collection(`${brand}_workflow_queue`)
    .where('status', '==', 'heygen_processing')
    .get();

  console.log(`   Found ${workflows.size} workflows stuck in heygen_processing\n`);

  let fixed = 0;

  for (const doc of workflows.docs) {
    const data = doc.data() as WorkflowData;
    const workflowId = doc.id;

    console.log(`📹 Processing ${workflowId}...`);

    if (!data.heygenVideoId) {
      console.log(`   ⚠️  No HeyGen video ID, skipping`);
      continue;
    }

    // Step 1: Fetch video URL from HeyGen
    const videoUrl = await fetchHeyGenVideoUrl(data.heygenVideoId);
    if (!videoUrl) {
      console.log(`   ⚠️  Video not ready yet, skipping`);
      continue;
    }

    // Step 2: Upload to R2 for permanent storage
    const permanentUrl = await downloadAndUploadToR2(videoUrl, workflowId);
    if (!permanentUrl) {
      console.log(`   ❌ Failed to upload to R2, skipping`);
      continue;
    }

    // Step 3: Update workflow with HeyGen video URL
    await doc.ref.update({
      heygenVideoUrl: permanentUrl,
      status: 'heygen_completed',
      updatedAt: new Date().toISOString(),
    });

    console.log(`   ✅ Updated to heygen_completed`);

    // Step 4: Trigger Submagic
    const title = data.title || workflowId;
    const submagicProjectId = await triggerSubmagic(permanentUrl, title, workflowId);

    if (submagicProjectId) {
      await doc.ref.update({
        submagicProjectId,
        status: 'submagic_processing',
        updatedAt: new Date().toISOString(),
      });
      console.log(`   ✅ Started Submagic processing\n`);
      fixed++;
    } else {
      console.log(`   ⚠️  Submagic failed, workflow at heygen_completed\n`);
    }
  }

  return fixed;
}

async function triggerSubmagicForReady(brand: string): Promise<number> {
  console.log(`\n🎬 Triggering Submagic for ready workflows (${brand})...`);

  const workflows = await db
    .collection(`${brand}_workflow_queue`)
    .where('status', '==', 'heygen_completed')
    .get();

  console.log(`   Found ${workflows.size} workflows ready for Submagic\n`);

  let triggered = 0;

  for (const doc of workflows.docs) {
    const data = doc.data() as WorkflowData;
    const workflowId = doc.id;

    console.log(`🎬 Processing ${workflowId}...`);

    // If no video URL but has heygenVideoId, fetch it first
    let videoUrl = data.heygenVideoUrl;

    if (!videoUrl && data.heygenVideoId) {
      console.log(`   🔍 Fetching HeyGen video URL...`);
      const fetchedUrl = await fetchHeyGenVideoUrl(data.heygenVideoId);

      if (fetchedUrl) {
        // Upload to R2 for permanent storage
        const permanentUrl = await downloadAndUploadToR2(fetchedUrl, workflowId);
        if (permanentUrl) {
          videoUrl = permanentUrl;
          await doc.ref.update({
            heygenVideoUrl: permanentUrl,
            updatedAt: new Date().toISOString(),
          });
          console.log(`   ✅ Uploaded video to R2`);
        }
      }
    }

    if (!videoUrl) {
      console.log(`   ⚠️  No video URL available, skipping`);
      continue;
    }

    const title = data.title || workflowId;
    const submagicProjectId = await triggerSubmagic(videoUrl, title, workflowId);

    if (submagicProjectId) {
      await doc.ref.update({
        submagicProjectId,
        status: 'submagic_processing',
        updatedAt: new Date().toISOString(),
      });
      console.log(`   ✅ Started Submagic processing\n`);
      triggered++;
    } else {
      console.log(`   ❌ Submagic trigger failed\n`);
    }
  }

  return triggered;
}

async function main() {
  console.log('🚨 EMERGENCY ABDULLAH WORKFLOW FIX\n');
  console.log('=' .repeat(60));

  const brand = 'abdullah';

  try {
    // Fix stuck HeyGen workflows
    const fixedHeyGen = await fixStuckHeyGenWorkflows(brand);

    // Trigger Submagic for ready workflows
    const triggeredSubmagic = await triggerSubmagicForReady(brand);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`   🔧 Fixed HeyGen workflows: ${fixedHeyGen}`);
    console.log(`   🎬 Triggered Submagic: ${triggeredSubmagic}`);
    console.log(`   ✅ Total processed: ${fixedHeyGen + triggeredSubmagic}`);
    console.log('\n💡 Note: Videos will complete within 5-15 minutes and auto-post');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
