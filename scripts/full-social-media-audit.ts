/**
 * Full Social Media System Audit
 * Checks all brands, platforms, workflows, and identifies issues
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY?.trim();

// Brand configurations
const BRANDS = [
  {
    id: 'carz',
    name: 'Carz Inc',
    profileId: process.env.LATE_CARZ_PROFILE_ID?.trim(),
    collection: 'carz_workflow_queue',
    feedCollection: 'carz_rss_feeds',
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
  },
  {
    id: 'ownerfi',
    name: 'OwnerFi',
    profileId: process.env.LATE_OWNERFI_PROFILE_ID?.trim(),
    collection: 'ownerfi_workflow_queue',
    feedCollection: 'ownerfi_rss_feeds',
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
  },
  {
    id: 'benefit',
    name: 'Benefit',
    profileId: process.env.LATE_OWNERFI_PROFILE_ID?.trim(), // Shares with ownerfi
    collection: 'benefit_workflow_queue',
    feedCollection: null,
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
  },
  {
    id: 'abdullah',
    name: 'Abdullah',
    profileId: process.env.LATE_ABDULLAH_PROFILE_ID?.trim(),
    collection: 'abdullah_workflow_queue',
    feedCollection: null,
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter'],
  },
  {
    id: 'personal',
    name: 'Personal',
    profileId: process.env.LATE_ABDULLAH_PROFILE_ID?.trim(), // Shares with abdullah
    collection: 'personal_workflow_queue',
    feedCollection: null,
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter'],
  },
  {
    id: 'gaza',
    name: 'Gaza Relief',
    profileId: process.env.LATE_GAZA_PROFILE_ID?.trim(),
    collection: 'gaza_workflow_queue',
    feedCollection: 'gaza_rss_feeds',
    expectedPlatforms: ['instagram', 'tiktok', 'threads', 'bluesky'],
  },
];

interface Issue {
  brand: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  message: string;
  details?: string;
}

const issues: Issue[] = [];

async function getLateAccounts(profileId: string): Promise<any[]> {
  try {
    const response = await fetch(
      `${LATE_BASE_URL}/accounts?profileId=${profileId}`,
      {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : data.accounts || data.data || [];
  } catch (error) {
    return [];
  }
}

async function getRecentPosts(profileId: string, limit: number = 10): Promise<any[]> {
  try {
    const response = await fetch(
      `${LATE_BASE_URL}/posts?profileId=${profileId}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.posts || data.data || [];
  } catch (error) {
    return [];
  }
}

async function auditBrand(brand: typeof BRANDS[0]) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${brand.name.toUpperCase()} (${brand.id})`);
  console.log(`${'─'.repeat(60)}\n`);

  // 1. Check profile ID
  if (!brand.profileId) {
    issues.push({
      brand: brand.id,
      severity: 'CRITICAL',
      category: 'Configuration',
      message: 'Missing Late.dev profile ID',
      details: `Environment variable LATE_${brand.id.toUpperCase()}_PROFILE_ID not set`
    });
    console.log(`  ❌ Profile ID: MISSING`);
    return;
  }
  console.log(`  ✅ Profile ID: ${brand.profileId.substring(0, 10)}...`);

  // 2. Check Late.dev accounts
  const accounts = await getLateAccounts(brand.profileId);
  const connectedPlatforms = accounts.map(a => a.platform?.toLowerCase());

  console.log(`\n  PLATFORM STATUS:`);
  for (const platform of brand.expectedPlatforms) {
    const account = accounts.find(a => a.platform?.toLowerCase() === platform.toLowerCase());
    if (account) {
      console.log(`    ✅ ${platform}: ${account.username || account.displayName || 'Connected'}`);
    } else {
      console.log(`    ❌ ${platform}: NOT CONNECTED`);
      issues.push({
        brand: brand.id,
        severity: platform === 'youtube' ? 'HIGH' : 'MEDIUM',
        category: 'Platform',
        message: `${platform} not connected in Late.dev`,
        details: `Expected platform "${platform}" is not connected for ${brand.name}`
      });
    }
  }

  // 3. Check workflow collection
  console.log(`\n  WORKFLOW STATUS:`);
  try {
    // Get workflow stats by status
    const statuses = ['pending', 'heygen_processing', 'submagic_processing', 'video_processing', 'posting', 'completed', 'failed'];
    const statusCounts: Record<string, number> = {};

    for (const status of statuses) {
      const snapshot = await db.collection(brand.collection)
        .where('status', '==', status)
        .limit(1000)
        .get();
      statusCounts[status] = snapshot.size;
    }

    console.log(`    Collection: ${brand.collection}`);
    for (const [status, count] of Object.entries(statusCounts)) {
      if (count > 0) {
        const icon = status === 'failed' ? '❌' : status === 'completed' ? '✅' : '⏳';
        console.log(`      ${icon} ${status}: ${count}`);
      }
    }

    // Check for stuck workflows
    const stuckStatuses = ['heygen_processing', 'submagic_processing', 'video_processing', 'posting'];
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const status of stuckStatuses) {
      const stuckSnapshot = await db.collection(brand.collection)
        .where('status', '==', status)
        .where('updatedAt', '<', oneHourAgo)
        .limit(10)
        .get();

      if (stuckSnapshot.size > 0) {
        issues.push({
          brand: brand.id,
          severity: 'HIGH',
          category: 'Workflow',
          message: `${stuckSnapshot.size} workflows stuck in "${status}" for over 1 hour`,
          details: `Check ${brand.collection} for stuck workflows`
        });
        console.log(`    ⚠️  STUCK: ${stuckSnapshot.size} in "${status}" > 1 hour`);
      }
    }

    // Check for recent failures
    const recentFailures = await db.collection(brand.collection)
      .where('status', '==', 'failed')
      .orderBy('failedAt', 'desc')
      .limit(5)
      .get();

    if (recentFailures.size > 0) {
      console.log(`\n    RECENT FAILURES:`);
      recentFailures.docs.forEach((doc: any) => {
        const data = doc.data();
        const failedAt = data.failedAt ? new Date(data.failedAt).toLocaleString() : 'Unknown';
        console.log(`      - ${failedAt}: ${data.error?.substring(0, 60) || 'Unknown error'}...`);
      });
    }

  } catch (error: any) {
    if (error.code === 9) {
      console.log(`    ⚠️  Missing Firestore index for status queries`);
      issues.push({
        brand: brand.id,
        severity: 'MEDIUM',
        category: 'Database',
        message: 'Missing Firestore composite index',
        details: 'Create index for status + updatedAt queries'
      });
    } else {
      console.log(`    ❌ Error querying workflows: ${error.message}`);
    }
  }

  // 4. Check recent Late.dev posts
  console.log(`\n  RECENT LATE.DEV POSTS:`);
  const recentPosts = await getRecentPosts(brand.profileId, 5);

  if (recentPosts.length === 0) {
    console.log(`    ⚠️  No recent posts found`);
  } else {
    for (const post of recentPosts) {
      const platforms = post.platforms?.map((p: any) => p.platform).join(', ') || 'unknown';
      const status = post.status || 'unknown';
      const createdAt = post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Unknown';

      const platformCount = post.platforms?.length || 0;
      const expectedCount = brand.expectedPlatforms.filter(p => p !== 'youtube').length;

      if (platformCount < expectedCount - 1) { // Allow 1 missing (youtube)
        issues.push({
          brand: brand.id,
          severity: 'MEDIUM',
          category: 'Platform',
          message: `Post only sent to ${platformCount} platforms (expected ${expectedCount})`,
          details: `Post ${post._id}: platforms = ${platforms}`
        });
        console.log(`    ⚠️  ${createdAt}: ${status} - ${platforms} (MISSING PLATFORMS)`);
      } else {
        console.log(`    ✅ ${createdAt}: ${status} - ${platforms}`);
      }

      // Check for failed platforms
      const failedPlatforms = post.platforms?.filter((p: any) =>
        p.status === 'failed' || p.status === 'error'
      ) || [];

      if (failedPlatforms.length > 0) {
        for (const fp of failedPlatforms) {
          issues.push({
            brand: brand.id,
            severity: 'MEDIUM',
            category: 'Platform',
            message: `${fp.platform} posting failed`,
            details: fp.errorMessage || 'No error message'
          });
        }
      }
    }
  }

  // 5. Check RSS feeds (if applicable)
  if (brand.feedCollection) {
    console.log(`\n  RSS FEED STATUS:`);
    try {
      const feedsSnapshot = await db.collection(brand.feedCollection).get();
      console.log(`    Total feeds: ${feedsSnapshot.size}`);

      let activeFeeds = 0;
      let inactiveFeeds = 0;

      feedsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.isActive !== false) {
          activeFeeds++;
        } else {
          inactiveFeeds++;
        }
      });

      console.log(`    Active: ${activeFeeds}, Inactive: ${inactiveFeeds}`);
    } catch (error: any) {
      console.log(`    ❌ Error querying feeds: ${error.message}`);
    }
  }
}

async function checkEnvironmentVariables() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ENVIRONMENT VARIABLES`);
  console.log(`${'═'.repeat(60)}\n`);

  const requiredVars = [
    'LATE_API_KEY',
    'LATE_CARZ_PROFILE_ID',
    'LATE_OWNERFI_PROFILE_ID',
    'LATE_ABDULLAH_PROFILE_ID',
    'LATE_GAZA_PROFILE_ID',
    'HEYGEN_API_KEY',
    'SUBMAGIC_API_KEY',
    'SUBMAGIC_WEBHOOK_SECRET',
    'CLOUD_TASKS_SECRET',
    'CRON_SECRET',
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ✅ ${varName}: Set`);
    } else {
      console.log(`  ❌ ${varName}: MISSING`);
      issues.push({
        brand: 'global',
        severity: 'CRITICAL',
        category: 'Configuration',
        message: `Missing environment variable: ${varName}`,
      });
    }
  }

  // Check workaround flags
  console.log(`\n  WORKAROUND FLAGS:`);
  const bypassQueue = process.env.LATE_BYPASS_QUEUE === 'true';
  const bypassQuota = process.env.BYPASS_HEYGEN_QUOTA_CHECK === 'true';

  console.log(`  ${bypassQueue ? '⚠️  ACTIVE' : '✅ OFF'} LATE_BYPASS_QUEUE`);
  console.log(`  ${bypassQuota ? '⚠️  ACTIVE' : '✅ OFF'} BYPASS_HEYGEN_QUOTA_CHECK`);

  if (bypassQueue) {
    issues.push({
      brand: 'global',
      severity: 'MEDIUM',
      category: 'Configuration',
      message: 'Late.dev queue bypass is ACTIVE',
      details: 'Posts will be published immediately instead of queued'
    });
  }

  if (bypassQuota) {
    issues.push({
      brand: 'global',
      severity: 'HIGH',
      category: 'Configuration',
      message: 'HeyGen quota check bypass is ACTIVE',
      details: 'Risk of overspending if quota API is working'
    });
  }
}

async function runFullAudit() {
  console.log('\n' + '═'.repeat(60));
  console.log('  SOCIAL MEDIA SYSTEM - FULL AUDIT');
  console.log('═'.repeat(60));
  console.log(`  Time: ${new Date().toLocaleString()}`);

  if (!LATE_API_KEY) {
    console.error('\n❌ LATE_API_KEY not configured - cannot run audit');
    process.exit(1);
  }

  // Check environment
  await checkEnvironmentVariables();

  // Audit each brand
  for (const brand of BRANDS) {
    await auditBrand(brand);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  AUDIT SUMMARY');
  console.log('═'.repeat(60));

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const high = issues.filter(i => i.severity === 'HIGH');
  const medium = issues.filter(i => i.severity === 'MEDIUM');
  const low = issues.filter(i => i.severity === 'LOW');

  console.log(`\n  Issues Found: ${issues.length}`);
  console.log(`    🔴 CRITICAL: ${critical.length}`);
  console.log(`    🟠 HIGH: ${high.length}`);
  console.log(`    🟡 MEDIUM: ${medium.length}`);
  console.log(`    🟢 LOW: ${low.length}`);

  if (critical.length > 0) {
    console.log('\n  CRITICAL ISSUES:');
    critical.forEach(i => {
      console.log(`    - [${i.brand}] ${i.message}`);
      if (i.details) console.log(`      ${i.details}`);
    });
  }

  if (high.length > 0) {
    console.log('\n  HIGH PRIORITY ISSUES:');
    high.forEach(i => {
      console.log(`    - [${i.brand}] ${i.message}`);
      if (i.details) console.log(`      ${i.details}`);
    });
  }

  if (medium.length > 0) {
    console.log('\n  MEDIUM PRIORITY ISSUES:');
    medium.forEach(i => {
      console.log(`    - [${i.brand}] ${i.message}`);
    });
  }

  console.log('\n' + '═'.repeat(60));
}

runFullAudit()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
