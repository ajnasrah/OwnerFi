/**
 * Check recent completed workflows to see which platforms actually posted
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

async function checkRecentPosts() {
  console.log('\n' + '='.repeat(70));
  console.log('  RECENT WORKFLOW POSTS CHECK');
  console.log('='.repeat(70) + '\n');

  const collections = [
    { name: 'carz_workflow_queue', brand: 'Carz' },
    { name: 'ownerfi_workflow_queue', brand: 'OwnerFi' },
    { name: 'abdullah_workflow_queue', brand: 'Abdullah' },
    { name: 'gaza_workflow_queue', brand: 'Gaza' },
  ];

  for (const { name, brand } of collections) {
    console.log(`\n--- ${brand} Recent Workflows ---\n`);

    try {
      // Get recent completed workflows
      const snapshot = await db.collection(name)
        .where('status', '==', 'completed')
        .orderBy('completedAt', 'desc')
        .limit(5)
        .get();

      if (snapshot.empty) {
        console.log('  No completed workflows found');
        continue;
      }

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const completedAt = data.completedAt
          ? new Date(data.completedAt).toLocaleString()
          : 'Unknown';

        console.log(`  📹 Workflow: ${doc.id}`);
        console.log(`     Title: ${data.articleTitle || data.title || 'Unknown'}`);
        console.log(`     Completed: ${completedAt}`);
        console.log(`     Late Post ID: ${data.latePostId || 'None'}`);
        console.log(`     Platforms Used: ${data.platformsUsed || 'Unknown'}`);
        console.log(`     Scheduled For: ${data.scheduledFor || 'Immediate'}`);

        // Check for any error or warning
        if (data.error) {
          console.log(`     ⚠️  Error: ${data.error}`);
        }
        if (data.skippedPlatforms) {
          console.log(`     ⚠️  Skipped: ${data.skippedPlatforms.join(', ')}`);
        }
        console.log('');
      }

    } catch (error: any) {
      // If index missing, try without orderBy
      if (error.code === 9 || error.message?.includes('index')) {
        console.log('  (Index not available, fetching without sort...)');
        const snapshot = await db.collection(name)
          .where('status', '==', 'completed')
          .limit(5)
          .get();

        for (const doc of snapshot.docs) {
          const data = doc.data();
          console.log(`  📹 ${data.articleTitle || data.title || doc.id}`);
          console.log(`     Late Post ID: ${data.latePostId || 'None'}`);
          console.log(`     Platforms: ${data.platformsUsed || 'Unknown'}`);
          console.log('');
        }
      } else {
        console.error(`  Error: ${error.message}`);
      }
    }
  }

  // Also check late_failures collection
  console.log('\n--- Recent Late Failures ---\n');

  try {
    const failuresSnapshot = await db.collection('late_failures')
      .limit(10)
      .get();

    if (failuresSnapshot.empty) {
      console.log('  No failures logged');
    } else {
      for (const doc of failuresSnapshot.docs) {
        const data = doc.data();
        console.log(`  ❌ Brand: ${data.brand}`);
        console.log(`     Error: ${data.error?.substring(0, 100) || 'Unknown'}`);
        console.log(`     Platforms: ${data.platforms?.join(', ') || 'Unknown'}`);
        console.log(`     Time: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown'}`);
        console.log('');
      }
    }
  } catch (error: any) {
    console.log(`  Could not fetch failures: ${error.message}`);
  }

  console.log('\n' + '='.repeat(70));
}

checkRecentPosts()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
