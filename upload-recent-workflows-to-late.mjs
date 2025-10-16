#!/usr/bin/env node

/**
 * Upload the last 3-5 completed workflows to GetLate
 * Usage: node upload-recent-workflows-to-late.mjs [count]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Firebase credentials not found in .env.local');
    console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
    process.exit(1);
  }

  try {
    initializeApp({
      credential: cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      })
    });
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = getFirestore();

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY;
const LATE_OWNERFI_PROFILE_ID = process.env.LATE_OWNERFI_PROFILE_ID;
const LATE_CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;

async function getLateAccounts(profileId) {
  const response = await fetch(
    `${LATE_BASE_URL}/accounts?profileId=${profileId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Late API error: ${response.status} - ${errorText}`);
  }

  let accountsData = await response.json();
  const accounts = Array.isArray(accountsData) ? accountsData :
                   accountsData.accounts ? accountsData.accounts :
                   accountsData.data ? accountsData.data : [];

  return accounts;
}

async function postToLate(videoUrl, caption, title, platforms, brand) {
  const profileId = brand === 'carz' ? LATE_CARZ_PROFILE_ID : LATE_OWNERFI_PROFILE_ID;

  console.log(`\n📤 Posting to Late (${brand})...`);
  console.log('   Profile ID:', profileId);
  console.log('   Platforms:', platforms.join(', '));
  console.log('   Caption:', caption.substring(0, 80) + '...');

  // Get accounts for this profile
  const accounts = await getLateAccounts(profileId);

  // Map platform names to account IDs
  const platformAccounts = platforms
    .map(platform => {
      const account = accounts.find(acc => acc.platform.toLowerCase() === platform.toLowerCase());
      if (!account) {
        console.warn(`⚠️  No ${platform} account found`);
        return null;
      }
      return {
        platform: platform,
        accountId: account._id
      };
    })
    .filter(Boolean);

  if (platformAccounts.length === 0) {
    throw new Error('No connected accounts found for requested platforms');
  }

  console.log(`   Found ${platformAccounts.length} connected accounts`);

  // Build platforms config
  const platformsConfig = platformAccounts.map(p => {
    const platformConfig = {
      platform: p.platform,
      accountId: p.accountId,
      platformSpecificData: {}
    };

    // Instagram: Reel
    if (p.platform === 'instagram') {
      platformConfig.platformSpecificData.contentType = 'reel';
    }

    // Facebook: Feed
    if (p.platform === 'facebook') {
      platformConfig.platformSpecificData.contentType = 'feed';
    }

    // YouTube Shorts
    if (p.platform === 'youtube') {
      platformConfig.platformSpecificData = {
        title: title.substring(0, 100),
        category: brand === 'carz' ? 'Autos & Vehicles' : 'News & Politics',
        privacy: 'public',
        madeForKids: false,
        short: true
      };
    }

    // TikTok
    if (p.platform === 'tiktok') {
      platformConfig.platformSpecificData.privacy = 'public';
    }

    return platformConfig;
  });

  // Build request body
  const requestBody = {
    content: caption,
    platforms: platformsConfig,
    mediaItems: [
      {
        type: 'video',
        url: videoUrl
      }
    ],
    publishNow: true // Immediate posting
  };

  const response = await fetch(
    `${LATE_BASE_URL}/posts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Late API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  console.log('   Raw response:', JSON.stringify(data).substring(0, 200));

  const postId = data.id || data.postId || data._id || data.post?.id || 'unknown';

  console.log(`✅ Posted successfully! Post ID: ${postId}`);

  return {
    success: true,
    postId: postId,
    platforms: platformAccounts.map(p => p.platform)
  };
}

async function getRecentCompletedWorkflows(brand, count = 5) {
  console.log(`\n🔍 Finding last ${count} completed workflows for ${brand}...`);

  const workflowsRef = db.collection(`${brand}_workflow_queue`);

  // Get all completed workflows that haven't been posted to Late yet
  const snapshot = await workflowsRef
    .where('status', '==', 'completed')
    .get();

  if (snapshot.empty) {
    console.log(`❌ No completed workflows found for ${brand}`);
    return [];
  }

  // Collect and sort by completedAt
  const workflows = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    // Only include workflows that don't have a latePostId (haven't been posted to Late yet)
    if (!data.latePostId) {
      workflows.push({ id: doc.id, ...data });
    }
  });

  // Sort by completedAt descending (newest first)
  workflows.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  // Take the last N workflows
  const recent = workflows.slice(0, count);

  console.log(`✅ Found ${recent.length} workflows that haven't been posted to Late`);
  recent.forEach((w, i) => {
    console.log(`   ${i + 1}. ${w.articleTitle?.substring(0, 50)}... (${new Date(w.completedAt).toLocaleString()})`);
  });

  return recent;
}

async function getVideoUrlFromR2(workflow) {
  // Check if there's a finalVideoUrl in R2 format
  const r2Domain = process.env.R2_PUBLIC_DOMAIN || 'https://ownerfi-videos.abdullahaj.workers.dev';

  if (workflow.finalVideoUrl && workflow.finalVideoUrl.includes(r2Domain)) {
    return workflow.finalVideoUrl;
  }

  // Try to construct R2 URL from submagic project ID
  if (workflow.submagicVideoId) {
    return `${r2Domain}/submagic-videos/${workflow.submagicVideoId}.mp4`;
  }

  // Fallback to any video URL
  return workflow.finalVideoUrl || workflow.videoUrl;
}

async function uploadWorkflowToLate(workflow, brand) {
  console.log(`\n📹 Processing workflow: ${workflow.id}`);
  console.log(`   Article: ${workflow.articleTitle}`);

  // Try to get video URL
  let videoUrl = await getVideoUrlFromR2(workflow);

  if (!videoUrl) {
    console.log(`❌ No video URL found for workflow ${workflow.id}`);
    return false;
  }

  const caption = workflow.caption || 'Check out this video! 🔥';
  const title = workflow.title || workflow.articleTitle || 'Viral Video';

  // All platforms - exclude Twitter for Carz
  const platforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads'];
  if (brand === 'ownerfi') {
    platforms.push('twitter', 'bluesky');
  }

  try {
    const result = await postToLate(videoUrl, caption, title, platforms, brand);

    // Update workflow with latePostId (only if we got a valid postId)
    if (result.postId && result.postId !== 'unknown') {
      const workflowRef = db.collection(`${brand}_workflow_queue`).doc(workflow.id);
      await workflowRef.update({
        latePostId: result.postId,
        postedToLateAt: Date.now()
      });
      console.log(`✅ Successfully posted and updated workflow!`);
    } else {
      console.log(`✅ Posted successfully but no postId returned (check Late dashboard)`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Failed to post workflow:`, error.message);
    return false;
  }
}

async function main() {
  const count = parseInt(process.argv[2]) || 5;

  console.log('🚀 Starting upload of recent completed workflows to GetLate...');
  console.log(`   Uploading last ${count} workflows per brand\n`);

  let successCount = 0;
  let failCount = 0;

  // Upload OwnerFi workflows
  console.log('═══════════════════════════════════════');
  console.log('📱 OWNERFI');
  console.log('═══════════════════════════════════════');

  const ownerfiWorkflows = await getRecentCompletedWorkflows('ownerfi', count);
  for (const workflow of ownerfiWorkflows) {
    const success = await uploadWorkflowToLate(workflow, 'ownerfi');
    if (success) successCount++;
    else failCount++;

    // Wait 2 seconds between posts to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Upload Carz workflows
  console.log('\n═══════════════════════════════════════');
  console.log('🚗 CARZ');
  console.log('═══════════════════════════════════════');

  const carzWorkflows = await getRecentCompletedWorkflows('carz', count);
  for (const workflow of carzWorkflows) {
    const success = await uploadWorkflowToLate(workflow, 'carz');
    if (success) successCount++;
    else failCount++;

    // Wait 2 seconds between posts to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Successfully posted: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📝 Total processed: ${successCount + failCount}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
