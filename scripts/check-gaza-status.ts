/**
 * Check Gaza posting status
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = admin.firestore();

async function checkGaza() {
  console.log('\n' + '='.repeat(70));
  console.log('  GAZA POSTING STATUS');
  console.log('='.repeat(70));

  // Check workflow queue
  console.log('\n📂 WORKFLOW QUEUE (gaza_workflow_queue):');

  const statuses = ['pending', 'heygen_processing', 'submagic_processing', 'video_processing', 'exporting', 'posting', 'completed', 'failed'];

  for (const status of statuses) {
    const snapshot = await db.collection('gaza_workflow_queue')
      .where('status', '==', status)
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();

    if (snapshot.size > 0) {
      console.log(`\n  ${status.toUpperCase()}: ${snapshot.size} workflows`);
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const updatedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown';
        const error = data.error ? ` - ERROR: ${data.error.substring(0, 60)}...` : '';
        console.log(`    - ${doc.id}: ${updatedAt}${error}`);
      });
    }
  }

  // Check recent RSS feeds
  console.log('\n📰 RSS FEEDS (gaza_rss_feeds):');
  try {
    const feedsSnapshot = await db.collection('gaza_rss_feeds')
      .orderBy('lastChecked', 'desc')
      .limit(5)
      .get();

    if (feedsSnapshot.empty) {
      console.log('  No RSS feeds configured');
    } else {
      feedsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const lastChecked = data.lastChecked ? new Date(data.lastChecked).toLocaleString() : 'Never';
        const isActive = data.isActive !== false ? '✅' : '❌';
        console.log(`  ${isActive} ${data.name || doc.id}: Last checked ${lastChecked}`);
      });
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // Check recent articles
  console.log('\n📄 RECENT ARTICLES (gaza_articles):');
  try {
    const articlesSnapshot = await db.collection('gaza_articles')
      .orderBy('publishedAt', 'desc')
      .limit(5)
      .get();

    if (articlesSnapshot.empty) {
      console.log('  No articles found');
    } else {
      articlesSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const publishedAt = data.publishedAt ? new Date(data.publishedAt).toLocaleString() : 'Unknown';
        const processed = data.processed ? '✅' : '⏳';
        console.log(`  ${processed} ${data.title?.substring(0, 50) || doc.id}... (${publishedAt})`);
      });
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // Check Late.dev posts for Gaza
  console.log('\n📱 LATE.DEV POSTS:');
  const LATE_API_KEY = process.env.LATE_API_KEY?.trim();
  const GAZA_PROFILE_ID = process.env.LATE_GAZA_PROFILE_ID?.trim();

  if (!LATE_API_KEY || !GAZA_PROFILE_ID) {
    console.log('  Missing LATE_API_KEY or LATE_GAZA_PROFILE_ID');
  } else {
    try {
      const response = await fetch(
        `https://getlate.dev/api/v1/posts?profileId=${GAZA_PROFILE_ID}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${LATE_API_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const posts = data.posts || data.data || data || [];

        if (posts.length === 0) {
          console.log('  No posts found in Late.dev');
        } else {
          posts.forEach((post: any) => {
            const createdAt = post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Unknown';
            const status = post.status || 'unknown';
            const platforms = post.platforms?.map((p: any) => `${p.platform}:${p.status}`).join(', ') || 'none';
            console.log(`  ${status === 'published' ? '✅' : status === 'partial' ? '⚠️' : '❌'} ${createdAt} - ${status}`);
            console.log(`     Platforms: ${platforms}`);
          });
        }
      } else {
        console.log(`  Late.dev API error: ${response.status}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Check if cron is running
  console.log('\n⏰ CRON STATUS:');
  console.log('  Check Vercel logs for cron execution');
  console.log('  generate-videos cron should trigger Gaza workflows');

  console.log('\n' + '='.repeat(70));
}

checkGaza()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
