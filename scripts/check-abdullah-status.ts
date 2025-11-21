import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('❌ Missing Firebase credentials');
  console.error('FIREBASE_PROJECT_ID:', FIREBASE_PROJECT_ID ? '✅' : '❌');
  console.error('FIREBASE_CLIENT_EMAIL:', FIREBASE_CLIENT_EMAIL ? '✅' : '❌');
  console.error('FIREBASE_PRIVATE_KEY:', FIREBASE_PRIVATE_KEY ? '✅' : '❌');
  process.exit(1);
}

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY,
  })
});

const db = getFirestore(app);

async function checkAbdullahStatus() {
  console.log('='.repeat(60));
  console.log('🔍 ABDULLAH BRAND STATUS CHECK');
  console.log('='.repeat(60));
  console.log('');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('  LATE_ABDULLAH_PROFILE_ID:', process.env.LATE_ABDULLAH_PROFILE_ID || '❌ Missing');
  console.log('  HEYGEN_API_KEY:', process.env.HEYGEN_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  CRON_SECRET:', process.env.CRON_SECRET ? '✅ Set' : '❌ Missing');
  console.log('');

  // Check recent workflows
  console.log('📊 Recent Workflows (Last 10):');
  console.log('-'.repeat(60));

  const snapshot = await db.collection('abdullah_workflow_queue')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (snapshot.empty) {
    console.log('❌ NO WORKFLOWS FOUND!');
    console.log('');
    console.log('Possible reasons:');
    console.log('  1. The cron job has never run successfully');
    console.log('  2. The cron job is failing before creating workflows');
    console.log('  3. The collection name is different');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Check Vercel cron logs for /api/cron/abdullah');
    console.log('  2. Manually trigger the cron: curl -X POST https://your-domain.com/api/cron/abdullah');
    console.log('  3. Check if there are any errors in the cron execution');
  } else {
    console.log(`Found ${snapshot.size} workflows\n`);

    const statusCounts: Record<string, number> = {};

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const status = data.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      console.log(`${index + 1}. ${doc.id}`);
      console.log(`   Status: ${status}`);
      console.log(`   Title: ${data.title || 'N/A'}`);
      console.log(`   Created: ${data.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}`);
      console.log(`   Updated: ${data.lastUpdated?.toDate?.()?.toLocaleString() || 'N/A'}`);

      if (data.error) {
        console.log(`   ⚠️  Error: ${data.error}`);
      }

      if (data.heygenVideoId) {
        console.log(`   HeyGen Video ID: ${data.heygenVideoId}`);
      }

      if (data.submagicVideoUrl || data.videoUrl) {
        console.log(`   Video URL: ${data.submagicVideoUrl || data.videoUrl}`);
      }

      if (data.latePostId) {
        console.log(`   Late Post ID: ${data.latePostId}`);
      }

      console.log('');
    });

    console.log('Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  }

  console.log('');
  console.log('='.repeat(60));

  // Check the most recent workflow in detail
  if (!snapshot.empty) {
    const mostRecent = snapshot.docs[0];
    const data = mostRecent.data();

    console.log('🔬 Most Recent Workflow Details:');
    console.log('-'.repeat(60));
    console.log('ID:', mostRecent.id);
    console.log('Status:', data.status);
    console.log('Created:', data.createdAt?.toDate?.()?.toLocaleString());
    console.log('');

    const now = new Date();
    const created = data.createdAt?.toDate?.();
    if (created) {
      const hoursSince = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      console.log(`Time since last workflow: ${hoursSince.toFixed(1)} hours`);

      if (hoursSince > 5) {
        console.log('⚠️  WARNING: No new workflows in over 5 hours!');
        console.log('   The cron should run every 3 hours at 9, 12, 15, 18, 21 (CST)');
        console.log('   Check if the cron is running in production');
      } else {
        console.log('✅ Workflows are being created regularly');
      }
    }
  }

  console.log('='.repeat(60));

  process.exit(0);
}

checkAbdullahStatus().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
