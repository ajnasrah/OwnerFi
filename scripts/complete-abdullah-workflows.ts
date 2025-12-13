/**
 * Complete Abdullah workflows manually
 * Downloads from Submagic, uploads to R2, posts to Late
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function completeWorkflows() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  const db = getFirestore();
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY!;
  const LATE_API_KEY = process.env.LATE_API_KEY!;
  const LATE_ABDULLAH_PROFILE_ID = process.env.LATE_ABDULLAH_PROFILE_ID!;

  // R2 config
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const bucketName = process.env.R2_BUCKET_NAME || 'ownerfi-podcast-videos';
  const r2PublicUrl = process.env.R2_PUBLIC_URL!;

  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  // Get all submagic_processing workflows
  const snap = await db.collection('abdullah_workflow_queue')
    .where('status', '==', 'submagic_processing')
    .get();

  console.log(`Found ${snap.docs.length} workflows to complete\n`);

  let success = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const workflowId = doc.id;
    const projectId = d.submagicProjectId || d.submagicVideoId;

    if (!projectId) {
      console.log(`${workflowId}: No project ID, skipping`);
      continue;
    }

    console.log(`\nProcessing: ${workflowId}`);
    console.log(`  Title: ${d.title || 'Unknown'}`);

    try {
      // 1. Get Submagic project with download URL
      const statusResp = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
        headers: { 'x-api-key': SUBMAGIC_API_KEY }
      });
      const project = await statusResp.json();

      if (project.status !== 'completed') {
        console.log(`  ⏳ Still ${project.status}, skipping`);
        continue;
      }

      const downloadUrl = project.directUrl || project.downloadUrl;
      if (!downloadUrl) {
        console.log(`  ❌ No download URL`);
        failed++;
        continue;
      }

      console.log(`  📥 Downloading video...`);

      // 2. Download video
      const videoResp = await fetch(downloadUrl);
      if (!videoResp.ok) {
        console.log(`  ❌ Download failed: ${videoResp.status}`);
        failed++;
        continue;
      }

      const videoBuffer = Buffer.from(await videoResp.arrayBuffer());
      const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`  ✅ Downloaded (${sizeMB} MB)`);

      // 3. Upload to R2
      const fileName = `abdullah/submagic-videos/${workflowId}.mp4`;
      console.log(`  ☁️  Uploading to R2...`);

      await r2Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: videoBuffer,
        ContentType: 'video/mp4',
      }));

      const publicVideoUrl = `${r2PublicUrl}/${fileName}`;
      console.log(`  ✅ Uploaded: ${publicVideoUrl}`);

      // 4. Get Late accounts
      const accountsResp = await fetch(`https://getlate.dev/api/v1/accounts?profileId=${LATE_ABDULLAH_PROFILE_ID}`, {
        headers: { 'Authorization': `Bearer ${LATE_API_KEY}` }
      });
      const accountsData = await accountsResp.json();

      // Handle different response formats
      const accounts = Array.isArray(accountsData) ? accountsData :
                       accountsData.accounts ? accountsData.accounts :
                       accountsData.data ? accountsData.data : [];

      // Map platforms to account IDs
      const platforms = ['instagram', 'tiktok', 'facebook', 'linkedin'];
      const platformAccounts = platforms.map(platform => {
        const account = accounts.find((acc: any) => acc.platform?.toLowerCase() === platform);
        if (!account) return null;
        return {
          platform,
          accountId: account._id || account.id,
          platformSpecificData: platform === 'instagram' ? { contentType: 'reel' } :
                                platform === 'tiktok' ? { privacy: 'public' } : {}
        };
      }).filter(Boolean);

      // 5. Post to Late
      console.log(`  📤 Posting to Late...`);

      const caption = d.caption || `${d.title} #Entrepreneurship #BusinessGrowth`;

      const lateResp = await fetch('https://getlate.dev/api/v1/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: caption,
          platforms: platformAccounts,
          mediaItems: [{ type: 'video', url: publicVideoUrl }],
          queuedFromProfile: LATE_ABDULLAH_PROFILE_ID,
          timezone: 'America/Chicago'
        })
      });

      const lateResult = await lateResp.json();

      if (!lateResp.ok) {
        console.log(`  ❌ Late error: ${JSON.stringify(lateResult)}`);
        failed++;
        continue;
      }

      const postId = lateResult.id || lateResult._id || lateResult.postId;
      console.log(`  ✅ Posted to Late: ${postId}`);

      // 6. Update workflow
      await db.collection('abdullah_workflow_queue').doc(workflowId).update({
        status: 'completed',
        finalVideoUrl: publicVideoUrl,
        latePostId: postId,
        completedAt: Date.now(),
        updatedAt: Date.now()
      });

      console.log(`  ✅ Workflow completed!`);
      success++;

      // Rate limit
      await new Promise(r => setTimeout(r, 2000));

    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`Completed: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log('========================================');
}

completeWorkflows().catch(console.error);
