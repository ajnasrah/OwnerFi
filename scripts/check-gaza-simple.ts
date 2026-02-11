/**
 * Simple Gaza status check
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
  console.log('  GAZA STATUS CHECK');
  console.log('='.repeat(70));

  // Get all workflows without complex query
  console.log('\n📂 ALL GAZA WORKFLOWS:');
  const snapshot = await db.collection('gaza_workflow_queue').limit(20).get();

  if (snapshot.empty) {
    console.log('  ❌ NO WORKFLOWS FOUND - Pipeline not running!');
  } else {
    const byStatus: Record<string, number> = {};
    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const status = data.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    console.log(`  Total workflows: ${snapshot.size}`);
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`    ${status}: ${count}`);
    });

    // Show last 5 workflows
    console.log('\n  Recent workflows:');
    const sorted = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 5);

    sorted.forEach((wf: any) => {
      const updatedAt = wf.updatedAt ? new Date(wf.updatedAt).toLocaleString() : 'Unknown';
      const error = wf.error ? ` ERROR: ${wf.error.substring(0, 50)}...` : '';
      console.log(`    ${wf.status}: ${wf.id} - ${updatedAt}${error}`);
    });
  }

  // Check Late.dev posts
  console.log('\n📱 LATE.DEV POSTS:');
  const LATE_API_KEY = process.env.LATE_API_KEY?.trim();
  const GAZA_PROFILE_ID = process.env.LATE_GAZA_PROFILE_ID?.trim();

  if (!GAZA_PROFILE_ID) {
    console.log('  ❌ LATE_GAZA_PROFILE_ID not set!');
    return;
  }

  const response = await fetch(
    `https://getlate.dev/api/v1/posts?profileId=${GAZA_PROFILE_ID}&limit=5`,
    {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    console.log(`  ❌ Late.dev API error: ${response.status}`);
    return;
  }

  const data = await response.json();
  const posts = data.posts || data.data || data || [];

  if (posts.length === 0) {
    console.log('  ❌ NO POSTS in Late.dev for Gaza!');
    console.log('  Last post was Jan 17 - nothing since then!');
  } else {
    posts.forEach((post: any) => {
      const createdAt = post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Unknown';
      const status = post.status || 'unknown';
      console.log(`  ${status === 'published' ? '✅' : '⚠️'} ${createdAt} - ${status}`);

      post.platforms?.forEach((p: any) => {
        const icon = p.status === 'published' ? '✅' : p.status === 'failed' ? '❌' : '⏳';
        const error = p.errorMessage ? `: ${p.errorMessage.substring(0, 40)}...` : '';
        console.log(`     ${icon} ${p.platform}: ${p.status}${error}`);
      });
    });
  }

  // Check RSS feeds
  console.log('\n📰 RSS FEEDS:');
  const feedsSnapshot = await db.collection('gaza_rss_feeds').limit(10).get();

  if (feedsSnapshot.empty) {
    console.log('  ❌ NO RSS FEEDS configured!');
  } else {
    feedsSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const lastChecked = data.lastChecked ? new Date(data.lastChecked).toLocaleString() : 'Never';
      const isActive = data.isActive !== false;
      console.log(`  ${isActive ? '✅' : '❌'} ${data.name || data.url}: ${lastChecked}`);
    });
  }

  console.log('\n' + '='.repeat(70));
}

checkGaza()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
