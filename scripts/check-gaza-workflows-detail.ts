/**
 * Check Gaza workflow details
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

async function checkGazaWorkflows() {
  console.log('\n' + '='.repeat(70));
  console.log('  GAZA WORKFLOW DETAILS');
  console.log('='.repeat(70));

  // Get pending and recent failed workflows
  const snapshot = await db.collection('gaza_workflow_queue').limit(10).get();

  snapshot.docs.forEach((doc: any) => {
    const data = doc.data();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Created: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown'}`);
    console.log(`Updated: ${data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown'}`);

    if (data.heygenVideoId) {
      console.log(`HeyGen Video ID: ${data.heygenVideoId}`);
    }
    if (data.submagicProjectId) {
      console.log(`Submagic Project ID: ${data.submagicProjectId}`);
    }
    if (data.submagicDownloadUrl) {
      console.log(`Submagic Download URL: ${data.submagicDownloadUrl.substring(0, 50)}...`);
    }
    if (data.finalVideoUrl) {
      console.log(`Final Video URL: ${data.finalVideoUrl.substring(0, 50)}...`);
    }
    if (data.latePostId) {
      console.log(`Late Post ID: ${data.latePostId}`);
    }
    if (data.error) {
      console.log(`ERROR: ${data.error}`);
    }
    if (data.articleTitle) {
      console.log(`Article: ${data.articleTitle.substring(0, 50)}...`);
    }
  });

  console.log('\n' + '='.repeat(70));
}

checkGazaWorkflows()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
