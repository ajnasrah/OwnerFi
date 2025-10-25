// Retry Failed Workflows - Re-post videos that failed due to R2 access issues
import admin from 'firebase-admin';
import { config } from 'dotenv';

config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const LATE_API_KEY = process.env.LATE_API_KEY;
const LATE_CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;
const LATE_OWNERFI_PROFILE_ID = process.env.LATE_OWNERFI_PROFILE_ID;
const LATE_PODCAST_PROFILE_ID = process.env.LATE_PODCAST_PROFILE_ID;

function getProfileId(brand) {
  switch (brand) {
    case 'carz': return LATE_CARZ_PROFILE_ID;
    case 'ownerfi': return LATE_OWNERFI_PROFILE_ID;
    case 'podcast': return LATE_PODCAST_PROFILE_ID;
    default: return null;
  }
}

async function getLateAccounts(profileId) {
  const response = await fetch(
    `https://getlate.dev/api/v1/accounts?profileId=${profileId}`,
    {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Late API error: ${response.status}`);
  }

  let accountsData = await response.json();
  return Array.isArray(accountsData) ? accountsData :
         accountsData.accounts ? accountsData.accounts :
         accountsData.data ? accountsData.data : [];
}

async function postToLate(videoUrl, caption, title, platforms, brand, profileId) {
  console.log(`\n📤 Posting to Late API...`);
  console.log(`   Brand: ${brand}`);
  console.log(`   Video URL: ${videoUrl}`);
  console.log(`   Platforms: ${platforms.join(', ')}`);

  // Get accounts for this profile
  const accounts = await getLateAccounts(profileId);

  // Map platform names to account IDs
  const platformConfigs = platforms
    .map(platform => {
      const account = accounts.find(acc => acc.platform.toLowerCase() === platform.toLowerCase());
      if (!account) {
        console.warn(`   ⚠️  No ${platform} account found`);
        return null;
      }

      const config = {
        platform: platform,
        accountId: account._id,
        platformSpecificData: {}
      };

      // Platform-specific configurations
      if (platform === 'instagram') {
        config.platformSpecificData.contentType = 'reel';
      } else if (platform === 'facebook') {
        config.platformSpecificData.contentType = 'feed';
      } else if (platform === 'youtube') {
        config.platformSpecificData = {
          title: title || caption.substring(0, 100),
          category: brand === 'carz' ? 'Autos & Vehicles' : 'News & Politics',
          privacy: 'public',
          madeForKids: false,
          short: true
        };
      } else if (platform === 'tiktok') {
        config.platformSpecificData.privacy = 'public';
      }

      return config;
    })
    .filter(Boolean);

  if (platformConfigs.length === 0) {
    throw new Error('No connected accounts found for requested platforms');
  }

  // Calculate next available time slot (immediate posting)
  const now = new Date();
  const scheduledTime = now.toISOString();

  const requestBody = {
    content: caption,
    platforms: platformConfigs,
    mediaItems: [
      {
        type: 'video',
        url: videoUrl
      }
    ],
    publishNow: true,
    scheduledFor: scheduledTime,
    timezone: 'America/New_York'
  };

  const response = await fetch('https://getlate.dev/api/v1/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Late API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log(`   ✅ Posted successfully!`);
  console.log(`   Post ID: ${data.id || data.postId}`);

  return {
    success: true,
    postId: data.id || data.postId,
    scheduledFor: data.scheduledFor || scheduledTime
  };
}

async function retryFailedWorkflows(dryRun = true) {
  console.log('🔄 Retry Failed Workflows\n');
  console.log(`Mode: ${dryRun ? '🧪 DRY RUN (no actual changes)' : '🚀 LIVE (will update workflows)'}\n`);

  const brands = [
    { name: 'carz', collection: 'workflow_queue' },
    { name: 'ownerfi', collection: 'workflow_queue' },
    { name: 'podcast', collection: 'podcast_workflow_queue' }
  ];

  const results = {
    total: 0,
    retried: 0,
    failed: 0,
    skipped: 0
  };

  for (const { name: brand, collection } of brands) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Checking ${brand.toUpperCase()} workflows...`);
    console.log(`${'='.repeat(60)}\n`);

    // Query ALL workflows (no status filter to avoid index issues)
    const allWorkflows = await db.collection(collection).limit(50).get();

    // Filter for failed workflows with video URLs
    const failedWorkflows = allWorkflows.docs.filter(doc => {
      const data = doc.data();
      return data.status === 'failed' && data.finalVideoUrl;
    });

    if (failedWorkflows.length === 0) {
      console.log(`   No failed workflows with video URLs found\n`);
      continue;
    }

    console.log(`   Found ${failedWorkflows.length} failed workflows with video URLs\n`);

    for (let i = 0; i < failedWorkflows.length; i++) {
      const doc = failedWorkflows[i];
      const workflow = doc.data();
      const workflowId = doc.id;

      results.total++;

      console.log(`\n${i + 1}. Workflow: ${workflowId}`);
      console.log(`   Title: ${workflow.title || workflow.articleTitle || workflow.episodeTitle || 'Unknown'}`);
      console.log(`   Error: ${(workflow.error || 'Unknown').substring(0, 100)}`);
      console.log(`   Video URL: ${workflow.finalVideoUrl}`);

      // Test if video URL is accessible
      try {
        const headResponse = await fetch(workflow.finalVideoUrl, { method: 'HEAD', timeout: 5000 });
        if (!headResponse.ok) {
          console.log(`   ❌ Video URL not accessible (${headResponse.status}), skipping`);
          results.skipped++;
          continue;
        }
        console.log(`   ✅ Video URL accessible (${headResponse.status})`);
      } catch (err) {
        console.log(`   ❌ Video URL failed to fetch: ${err.message}, skipping`);
        results.skipped++;
        continue;
      }

      // Prepare posting data
      const caption = workflow.caption || 'Check out this video! 🔥';
      const title = workflow.title || workflow.articleTitle || workflow.episodeTitle || 'Viral Video';
      const platforms = workflow.platforms || ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads'];

      // Add Twitter/Bluesky for OwnerFi
      if (brand === 'ownerfi') {
        platforms.push('twitter', 'bluesky');
      }

      const profileId = getProfileId(brand);
      if (!profileId) {
        console.log(`   ❌ No profile ID configured for ${brand}, skipping`);
        results.skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`   🧪 [DRY RUN] Would post to: ${platforms.join(', ')}`);
        console.log(`   🧪 [DRY RUN] Would update workflow to 'completed'`);
        results.retried++;
      } else {
        // Actually retry posting
        try {
          const postResult = await postToLate(
            workflow.finalVideoUrl,
            caption,
            title,
            platforms,
            brand,
            profileId
          );

          // Update workflow status to completed
          await db.collection(collection).doc(workflowId).update({
            status: 'completed',
            latePostId: postResult.postId,
            completedAt: Date.now(),
            retriedAt: Date.now(),
            error: null // Clear error
          });

          console.log(`   ✅ Successfully retried and updated workflow`);
          results.retried++;

        } catch (err) {
          console.error(`   ❌ Failed to retry: ${err.message}`);
          results.failed++;
        }
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total workflows checked: ${results.total}`);
  console.log(`✅ Successfully retried: ${results.retried}`);
  console.log(`❌ Failed to retry: ${results.failed}`);
  console.log(`⚠️  Skipped (no video): ${results.skipped}`);
  console.log('');

  if (dryRun) {
    console.log('🧪 This was a DRY RUN. No changes were made.');
    console.log('💡 Run with --live flag to actually retry workflows:');
    console.log('   node retry-failed-workflows.mjs --live\n');
  } else {
    console.log('✅ Workflows have been retried and updated!\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLive = args.includes('--live');

retryFailedWorkflows(!isLive)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
