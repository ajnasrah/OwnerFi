import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
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

async function findByPostId(postId: string) {
  console.log(`🔍 Searching for workflow with Late Post ID: ${postId}\n`);

  const collections = [
    'ownerfi_workflow_queue',
    'carz_workflow_queue',
    'vassdistro_workflow_queue',
    'abdullah_workflow_queue',
  ];

  for (const collectionName of collections) {
    try {
      // Search by latePostId field
      const q = query(
        collection(db, collectionName),
        where('latePostId', '==', postId)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log(`✅ Found in collection: ${collectionName}\n`);
        console.log(`📄 Workflow ID: ${doc.id}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Article: ${data.articleTitle || 'N/A'}`);
        console.log(`   Caption present: ${data.caption ? '✅ YES' : '❌ NO'}`);

        if (data.caption) {
          console.log(`\n   Caption: "${data.caption}"`);
        } else {
          console.log(`\n   ⚠️  NO CAPTION - Used fallback!`);
        }

        if (data.title) {
          console.log(`\n   Title: "${data.title}"`);
        }

        return;
      }

      // Also try searching for partial matches in latePostId (comma-separated)
      const allDocs = await getDocs(collection(db, collectionName));
      for (const doc of allDocs.docs) {
        const data = doc.data();
        if (data.latePostId && data.latePostId.includes(postId)) {
          console.log(`✅ Found partial match in collection: ${collectionName}\n`);
          console.log(`📄 Workflow ID: ${doc.id}`);
          console.log(`   Late Post IDs: ${data.latePostId}`);
          console.log(`   Caption present: ${data.caption ? '✅ YES' : '❌ NO'}`);

          if (data.caption) {
            console.log(`\n   Caption: "${data.caption}"`);
          } else {
            console.log(`\n   ⚠️  NO CAPTION - Used fallback!`);
          }
          return;
        }
      }
    } catch (error) {
      // Continue to next collection
    }
  }

  console.log('❌ No workflow found with this post ID');
}

const postIds = [
  '6910bb5b22b09b68e161c8db',
  '6910bb4022b09b68e161c86b',
  '6910b434b33c296d772639ef'
];

(async () => {
  for (const postId of postIds) {
    await findByPostId(postId);
    console.log('\n' + '='.repeat(60) + '\n');
  }
  console.log('✅ Done');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
