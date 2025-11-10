import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, or } from 'firebase/firestore';
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

async function checkInProgressWorkflows() {
  console.log('🔍 Checking in-progress OwnerFi workflows for caption data...\n');

  const q = query(
    collection(db, 'ownerfi_workflow_queue'),
    or(
      where('status', '==', 'heygen_processing'),
      where('status', '==', 'submagic_processing'),
      where('status', '==', 'video_processing'),
      where('status', '==', 'posting')
    )
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log('✅ No workflows currently in progress');
    return;
  }

  console.log(`📄 Found ${snapshot.size} in-progress workflows:\n`);

  snapshot.forEach((doc) => {
    const data = doc.data();
    const articlePreview = data.articleTitle ? data.articleTitle.substring(0, 50) : 'N/A';
    console.log(`\n📄 Workflow: ${doc.id}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Article: ${articlePreview}...`);
    console.log(`   Caption present: ${data.caption ? '✅ YES' : '❌ NO'}`);
    console.log(`   Title present: ${data.title ? '✅ YES' : '❌ NO'}`);

    if (data.caption) {
      const captionPreview = data.caption.substring(0, 80);
      console.log(`   Caption preview: "${captionPreview}..."`);
    } else {
      console.log(`   ⚠️  WARNING: No caption - will use fallback "Check out this video!"`);
    }

    if (data.title) {
      console.log(`   Title: "${data.title}"`);
    } else {
      console.log(`   ⚠️  WARNING: No title - will use fallback "Viral Video"`);
    }

    console.log(`   Created: ${new Date(data.createdAt).toISOString()}`);
    console.log(`   Status Changed: ${data.statusChangedAt ? new Date(data.statusChangedAt).toISOString() : 'N/A'}`);
  });
}

checkInProgressWorkflows().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
