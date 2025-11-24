import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function checkPostingHistory() {
  console.log('=== Carz Inc Posting History ===\n');

  // Get last 20 workflows
  const workflowsRef = db.collection('carz_workflow_queue');
  const recentWorkflows = await workflowsRef
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  console.log(`Total workflows checked: ${recentWorkflows.size}\n`);

  // Filter completed workflows with posts
  const completedWithPosts = recentWorkflows.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((w: any) => w.status === 'completed' && w.latePostId);

  console.log(`Completed posts: ${completedWithPosts.length}\n`);

  if (completedWithPosts.length === 0) {
    console.log('❌ No completed posts found in last 20 workflows!\n');
    return;
  }

  console.log('=== Last 10 Successful Posts ===\n');
  completedWithPosts.slice(0, 10).forEach((w: any, i) => {
    const created = w.createdAt;
    let createdDate = 'N/A';

    if (created) {
      if (typeof created === 'number') {
        createdDate = new Date(created).toLocaleString();
      } else if (created instanceof Timestamp) {
        createdDate = created.toDate().toLocaleString();
      } else if (created.toDate) {
        createdDate = created.toDate().toLocaleString();
      }
    }

    console.log(`${i+1}. Post ID: ${w.latePostId}`);
    console.log(`   Workflow: ${w.id.substring(0, 20)}...`);
    console.log(`   Created: ${createdDate}`);
    console.log(`   Article: ${(w.article?.title || 'N/A').substring(0, 60)}`);
    console.log('');
  });

  // Calculate posting frequency
  if (completedWithPosts.length >= 2) {
    const newest = completedWithPosts[0] as any;
    const oldest = completedWithPosts[completedWithPosts.length - 1] as any;

    let newestTime = 0;
    let oldestTime = 0;

    if (newest.createdAt) {
      if (typeof newest.createdAt === 'number') {
        newestTime = newest.createdAt;
      } else if (newest.createdAt.toDate) {
        newestTime = newest.createdAt.toDate().getTime();
      }
    }

    if (oldest.createdAt) {
      if (typeof oldest.createdAt === 'number') {
        oldestTime = oldest.createdAt;
      } else if (oldest.createdAt.toDate) {
        oldestTime = oldest.createdAt.toDate().getTime();
      }
    }

    if (newestTime && oldestTime) {
      const daysSince = (newestTime - oldestTime) / (1000 * 60 * 60 * 24);
      const postsPerDay = completedWithPosts.length / daysSince;

      console.log('=== Posting Frequency ===\n');
      console.log(`Days covered: ${daysSince.toFixed(1)}`);
      console.log(`Posts per day: ${postsPerDay.toFixed(1)}`);
      console.log(`Expected: 5 posts/day (cron runs at 9am, 12pm, 3pm, 6pm, 9pm)`);
    }
  }

  // Check for current processing
  const processing = recentWorkflows.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((w: any) => ['pending', 'heygen_processing', 'video_processing', 'post_processing'].includes(w.status));

  console.log(`\n=== Currently Processing: ${processing.length} ===\n`);
  processing.forEach((w: any, i) => {
    console.log(`${i+1}. Status: ${w.status}`);
    console.log(`   Workflow: ${w.id.substring(0, 20)}...`);
  });
}

checkPostingHistory().catch(console.error);
