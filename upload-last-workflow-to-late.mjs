#!/usr/bin/env node

/**
 * Upload the last completed workflow to GetLate
 * Usage: node upload-last-workflow-to-late.mjs
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
  console.log('   Video URL:', videoUrl);
  console.log('   Caption:', caption.substring(0, 100) + '...');

  // Get accounts for this profile
  const accounts = await getLateAccounts(profileId);

  // Map platform names to account IDs
  const platformAccounts = platforms
    .map(platform => {
      const account = accounts.find(acc => acc.platform.toLowerCase() === platform.toLowerCase());
      if (!account) {
        console.warn(`⚠️  No ${platform} account found for profile ${profileId}`);
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

  console.log(`✅ Posted to Late (${brand}) successfully!`);
  console.log('   Post ID:', data.id || data.postId);

  return {
    success: true,
    postId: data.id || data.postId,
    platforms: platformAccounts.map(p => p.platform)
  };
}

async function getLastCompletedWorkflow(brand) {
  console.log(`\n🔍 Finding last completed workflow for ${brand}...`);

  const workflowsRef = db.collection(`${brand}_workflow_queue`);

  // Get all completed workflows (no index required)
  const snapshot = await workflowsRef
    .where('status', '==', 'completed')
    .get();

  if (snapshot.empty) {
    console.log(`❌ No completed workflows found for ${brand}`);
    return null;
  }

  // Find the most recent one by completedAt
  let latestDoc = null;
  let latestTime = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    const completedAt = data.completedAt || 0;
    if (completedAt > latestTime) {
      latestTime = completedAt;
      latestDoc = { id: doc.id, ...data };
    }
  });

  if (!latestDoc) {
    console.log(`❌ No completed workflows found for ${brand}`);
    return null;
  }

  console.log(`✅ Found workflow: ${latestDoc.id}`);
  console.log(`   Article: ${latestDoc.articleTitle}`);
  console.log(`   Completed: ${new Date(latestDoc.completedAt).toLocaleString()}`);
  console.log(`   Status: ${latestDoc.status}`);
  console.log(`   Fields:`, Object.keys(latestDoc).join(', '));

  return latestDoc;
}

async function getVideoUrlFromSubmagic(submagicProjectId) {
  console.log(`\n📹 Fetching video URL from Submagic API...`);

  const response = await fetch(
    `https://api.submagic.co/v1/projects/${submagicProjectId}`,
    {
      headers: {
        'x-api-key': process.env.SUBMAGIC_API_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Submagic API error: ${response.status}`);
  }

  const data = await response.json();
  const videoUrl = data.media_url || data.video_url || data.downloadUrl;

  if (!videoUrl) {
    throw new Error('No video URL in Submagic response');
  }

  console.log(`✅ Got video URL from Submagic`);
  return videoUrl;
}

async function uploadWorkflowToLate(brand) {
  const workflow = await getLastCompletedWorkflow(brand);

  if (!workflow) {
    return;
  }

  // Try to get video URL from different sources
  let videoUrl = workflow.finalVideoUrl || workflow.videoUrl;

  if (!videoUrl && workflow.submagicVideoId) {
    try {
      videoUrl = await getVideoUrlFromSubmagic(workflow.submagicVideoId);
    } catch (error) {
      console.log(`❌ Failed to get video from Submagic:`, error.message);
    }
  }

  if (!videoUrl) {
    console.log(`❌ No video URL found in workflow (tried: finalVideoUrl, videoUrl, Submagic API)`);
    return;
  }
  const caption = workflow.caption || 'Check out this video! 🔥';
  const title = workflow.title || workflow.articleTitle || 'Viral Video';

  // All platforms
  const platforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter'];
  if (brand === 'ownerfi') {
    platforms.push('bluesky');
  }

  console.log(`\n📊 Workflow Details:`);
  console.log(`   Brand: ${brand}`);
  console.log(`   Video URL: ${videoUrl}`);
  console.log(`   Title: ${title}`);
  console.log(`   Caption: ${caption.substring(0, 100)}...`);

  try {
    const result = await postToLate(videoUrl, caption, title, platforms, brand);
    console.log(`\n✅ Successfully posted to Late!`);
    console.log(`   Post ID: ${result.postId}`);
    console.log(`   Platforms: ${result.platforms.join(', ')}`);
  } catch (error) {
    console.error(`\n❌ Failed to post to Late:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting upload of last completed workflows to GetLate...\n');

  // Upload OwnerFi workflow
  console.log('═══════════════════════════════════════');
  console.log('📱 OWNERFI');
  console.log('═══════════════════════════════════════');
  await uploadWorkflowToLate('ownerfi');

  // Upload Carz workflow
  console.log('\n═══════════════════════════════════════');
  console.log('🚗 CARZ');
  console.log('═══════════════════════════════════════');
  await uploadWorkflowToLate('carz');

  console.log('\n✅ All uploads complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
