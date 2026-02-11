/**
 * Check completed Gaza workflow
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

async function checkCompleted() {
  console.log('\n' + '='.repeat(70));
  console.log('  GAZA COMPLETED WORKFLOW');
  console.log('='.repeat(70));

  // Get completed workflows
  const snapshot = await db.collection('gaza_workflow_queue')
    .where('status', '==', 'completed')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('No completed workflows found');
    return;
  }

  snapshot.docs.forEach((doc: any) => {
    const data = doc.data();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Created: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown'}`);
    console.log(`Updated: ${data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown'}`);
    console.log(`Completed: ${data.completedAt ? new Date(data.completedAt).toLocaleString() : 'Unknown'}`);

    console.log(`\nHeyGen:`);
    console.log(`  Video ID: ${data.heygenVideoId || 'N/A'}`);

    console.log(`\nSubmagic:`);
    console.log(`  Project ID: ${data.submagicProjectId || data.submagicVideoId || 'N/A'}`);
    console.log(`  Download URL: ${data.submagicDownloadUrl ? 'YES' : 'N/A'}`);

    console.log(`\nFinal:`);
    console.log(`  Video URL: ${data.finalVideoUrl ? 'YES' : 'N/A'}`);
    console.log(`  Late Post ID: ${data.latePostId || 'N/A'}`);

    console.log(`\nAll keys in doc:`);
    Object.keys(data).forEach(key => {
      const val = data[key];
      const display = typeof val === 'string' && val.length > 50
        ? val.substring(0, 50) + '...'
        : val;
      console.log(`  ${key}: ${display}`);
    });
  });

  console.log('\n' + '='.repeat(70));
}

checkCompleted()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
