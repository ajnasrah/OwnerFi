import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function checkCarzWorkflows() {
  console.log('=== Checking Carz Inc Workflows ===\n');

  // Check last 10 workflows
  const workflowsRef = db.collection('carz_workflow_queue');
  const recentWorkflows = await workflowsRef
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log(`Total workflows found: ${recentWorkflows.size}\n`);

  if (recentWorkflows.empty) {
    console.log('❌ No Carz workflows found in database!\n');

    // Check RSS feeds
    const feedsRef = db.collection('carz_rss_feeds');
    const feeds = await feedsRef.get();
    console.log(`RSS Feeds configured: ${feeds.size}\n`);

    if (!feeds.empty) {
      console.log('Available feeds:');
      feeds.docs.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.url || doc.id}`);
      });
    }

    // Check articles
    const articlesRef = db.collection('carz_articles');
    const articles = await articlesRef.orderBy('createdAt', 'desc').limit(5).get();
    console.log(`\nRecent articles: ${articles.size}`);

    if (!articles.empty) {
      articles.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`  ${i+1}. ${data.title?.substring(0, 60) || 'No title'}`);
      });
    }

    return;
  }

  // Group by status
  const byStatus: Record<string, number> = {};
  const workflows = recentWorkflows.docs.map(doc => {
    const data = doc.data();
    byStatus[data.status] = (byStatus[data.status] || 0) + 1;
    return { id: doc.id, ...data };
  });

  console.log('Status breakdown (last 10):');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n=== Recent Workflows ===\n');
  workflows.slice(0, 5).forEach((w, i) => {
    console.log(`${i+1}. ID: ${w.id.substring(0, 8)}...`);
    console.log(`   Status: ${w.status}`);
    console.log(`   Created: ${w.createdAt?.toDate?.() || 'N/A'}`);
    console.log(`   Step: ${w.currentStep || 'N/A'}`);
    if (w.error) console.log(`   Error: ${w.error}`);
    if (w.latePostId) console.log(`   Post ID: ${w.latePostId}`);
    console.log('');
  });

  // Check for pending workflows
  const pending = await workflowsRef
    .where('status', '==', 'pending')
    .limit(5)
    .get();

  console.log(`\n=== Pending Workflows: ${pending.size} ===\n`);
  if (pending.size > 0) {
    pending.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i+1}. Created: ${data.createdAt?.toDate?.() || 'N/A'}`);
      console.log(`   Step: ${data.currentStep || 'N/A'}`);
    });
  }

  // Check for stuck workflows
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stuck = await workflowsRef
    .where('status', 'in', ['pending', 'processing'])
    .where('createdAt', '<', oneDayAgo)
    .limit(5)
    .get();

  console.log(`\n=== Stuck Workflows (>24h): ${stuck.size} ===\n`);
  if (stuck.size > 0) {
    stuck.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i+1}. Created: ${data.createdAt?.toDate?.() || 'N/A'}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Step: ${data.currentStep || 'N/A'}`);
      if (data.error) console.log(`   Error: ${data.error}`);
    });
  }
}

checkCarzWorkflows().catch(console.error);
