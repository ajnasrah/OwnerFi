/**
 * Post already-uploaded videos to Late
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function postToLate() {
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
  const LATE_API_KEY = process.env.LATE_API_KEY!;
  const LATE_ABDULLAH_PROFILE_ID = process.env.LATE_ABDULLAH_PROFILE_ID!;
  const r2PublicUrl = process.env.R2_PUBLIC_URL!;

  // Get all submagic_processing workflows (videos already uploaded to R2)
  const snap = await db.collection('abdullah_workflow_queue')
    .where('status', '==', 'submagic_processing')
    .get();

  console.log(`Found ${snap.docs.length} workflows to post\n`);

  // First get accounts once
  console.log('Fetching Late accounts...');
  const accountsResp = await fetch(`https://getlate.dev/api/v1/accounts?profileId=${LATE_ABDULLAH_PROFILE_ID}`, {
    headers: { 'Authorization': `Bearer ${LATE_API_KEY}` }
  });
  const accountsData = await accountsResp.json();
  console.log('Accounts response:', JSON.stringify(accountsData).slice(0, 200));

  const accounts = Array.isArray(accountsData) ? accountsData :
                   accountsData.accounts ? accountsData.accounts :
                   accountsData.data ? accountsData.data : [];

  console.log(`Found ${accounts.length} accounts\n`);

  // Build platform mapping
  const platforms = ['instagram', 'tiktok', 'facebook', 'linkedin'];
  const platformAccounts = platforms.map(platform => {
    const account = accounts.find((acc: any) => acc.platform?.toLowerCase() === platform);
    if (!account) {
      console.log(`  ⚠️ No ${platform} account found`);
      return null;
    }
    console.log(`  ✅ ${platform}: ${account._id || account.id}`);
    return {
      platform,
      accountId: account._id || account.id,
      platformSpecificData: platform === 'instagram' ? { contentType: 'reel' } :
                            platform === 'tiktok' ? { privacy: 'public' } : {}
    };
  }).filter(Boolean);

  if (platformAccounts.length === 0) {
    console.error('No platform accounts found!');
    process.exit(1);
  }

  console.log(`\nPosting to ${platformAccounts.length} platforms\n`);

  let success = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const workflowId = doc.id;

    // Check if video exists on R2
    const videoUrl = `${r2PublicUrl}/abdullah/submagic-videos/${workflowId}.mp4`;

    console.log(`\nProcessing: ${workflowId}`);
    console.log(`  Title: ${d.title || 'Unknown'}`);
    console.log(`  Video: ${videoUrl}`);

    // Verify video exists
    try {
      const headResp = await fetch(videoUrl, { method: 'HEAD' });
      if (!headResp.ok) {
        console.log(`  ❌ Video not found on R2 (${headResp.status})`);
        failed++;
        continue;
      }
    } catch (e) {
      console.log(`  ❌ Video check failed`);
      failed++;
      continue;
    }

    try {
      const caption = d.caption || `${d.title} #Entrepreneurship #BusinessGrowth #Success`;

      const lateResp = await fetch('https://getlate.dev/api/v1/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: caption,
          platforms: platformAccounts,
          mediaItems: [{ type: 'video', url: videoUrl }],
          queuedFromProfile: LATE_ABDULLAH_PROFILE_ID,
          timezone: 'America/Chicago'
        })
      });

      const lateResult = await lateResp.json();

      if (!lateResp.ok) {
        console.log(`  ❌ Late error: ${JSON.stringify(lateResult).slice(0, 200)}`);
        failed++;
        continue;
      }

      const postId = lateResult.id || lateResult._id || lateResult.postId || lateResult.post?.id || 'posted';
      console.log(`  ✅ Posted to Late: ${postId}`);
      console.log(`  Response: ${JSON.stringify(lateResult).slice(0, 150)}`);

      // Update workflow
      await db.collection('abdullah_workflow_queue').doc(workflowId).update({
        status: 'completed',
        finalVideoUrl: videoUrl,
        latePostId: postId || 'posted',
        completedAt: Date.now(),
        updatedAt: Date.now()
      });

      success++;

      // Rate limit
      await new Promise(r => setTimeout(r, 1500));

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

postToLate().catch(console.error);
