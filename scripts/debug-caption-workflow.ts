import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugWorkflows() {
  console.log('🔍 Checking for workflows with generic captions...\n');

  // Check ownerfi workflows
  const q = query(
    collection(db, 'ownerfi_workflow_queue'),
    where('status', '==', 'completed'),
    orderBy('completedAt', 'desc'),
    limit(10)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log('❌ No completed workflows found');
    return;
  }

  let foundGeneric = false;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const articlePreview = data.articleTitle ? data.articleTitle.substring(0, 40) : 'N/A';

    const hasGenericCaption = !data.caption ||
                               data.caption.includes('Check out this video') ||
                               data.caption.length < 50;

    const hasGenericTitle = !data.title ||
                            data.title.includes('Viral Video') ||
                            data.title.length < 10;

    if (hasGenericCaption || hasGenericTitle) {
      foundGeneric = true;
      console.log(`\n⚠️  GENERIC CONTENT FOUND:`);
      console.log(`   Workflow ID: ${doc.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Article: ${articlePreview}...`);
      console.log(`   Caption: "${data.caption || 'MISSING'}"`);
      console.log(`   Title: "${data.title || 'MISSING'}"`);
      console.log(`   Completed: ${data.completedAt ? new Date(data.completedAt).toISOString() : 'N/A'}`);

      // Check if caption/title were set during workflow
      console.log(`\n   Debug Info:`);
      console.log(`   - submagicProjectId: ${data.submagicProjectId || 'MISSING'}`);
      console.log(`   - heygenVideoId: ${data.heygenVideoId || 'MISSING'}`);
      console.log(`   - Has finalVideoUrl: ${data.finalVideoUrl ? 'YES' : 'NO'}`);
    }
  });

  if (!foundGeneric) {
    console.log('\n✅ All recent completed workflows have proper captions and titles!');
  }
}

debugWorkflows().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
