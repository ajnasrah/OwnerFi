import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

async function checkWorkflow(workflowId: string) {
  console.log(`🔍 Checking workflow: ${workflowId}\n`);

  // Try different collections
  const collections = [
    'ownerfi_workflow_queue',
    'carz_workflow_queue',
    'vassdistro_workflow_queue',
    'abdullah_workflow_queue',
    'podcast_workflow_queue',
    'benefit_workflow_queue'
  ];

  for (const collectionName of collections) {
    try {
      const docRef = doc(db, collectionName, workflowId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`✅ Found in collection: ${collectionName}\n`);
        console.log(`📄 Workflow Details:`);
        console.log(`   ID: ${docSnap.id}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Article: ${data.articleTitle || data.episodeTitle || 'N/A'}`);
        console.log(`   Created: ${data.createdAt ? new Date(data.createdAt).toISOString() : 'N/A'}`);
        console.log(`   Updated: ${data.updatedAt ? new Date(data.updatedAt).toISOString() : 'N/A'}`);
        console.log(`   Status Changed: ${data.statusChangedAt ? new Date(data.statusChangedAt).toISOString() : 'N/A'}`);

        console.log(`\n📝 Caption Data:`);
        console.log(`   Caption present: ${data.caption ? '✅ YES' : '❌ NO'}`);
        console.log(`   Title present: ${data.title ? '✅ YES' : '❌ NO'}`);

        if (data.caption) {
          console.log(`\n   Full Caption:`);
          console.log(`   "${data.caption}"`);
        } else {
          console.log(`\n   ⚠️  WARNING: No caption found!`);
          console.log(`   Will use fallback: "Check out this video! 🔥"`);
        }

        if (data.title) {
          console.log(`\n   Title: "${data.title}"`);
        } else {
          console.log(`\n   ⚠️  WARNING: No title found!`);
          console.log(`   Will use fallback: "Viral Video"`);
        }

        console.log(`\n🎬 Video URLs:`);
        console.log(`   HeyGen ID: ${data.heygenVideoId || 'N/A'}`);
        console.log(`   Submagic ID: ${data.submagicProjectId || data.submagicVideoId || 'N/A'}`);
        console.log(`   Final URL: ${data.finalVideoUrl ? 'YES' : 'NO'}`);
        console.log(`   Late Post ID: ${data.latePostId || 'N/A'}`);

        if (data.error) {
          console.log(`\n❌ Error: ${data.error}`);
        }

        console.log(`\n📊 Full Document Data:`);
        console.log(JSON.stringify(data, null, 2));

        return;
      }
    } catch (error) {
      // Collection doesn't exist or other error, continue
    }
  }

  console.log('❌ Workflow not found in any collection');
}

const workflowId = process.argv[2] || '6910bb5b22b09b68e161c8db';
checkWorkflow(workflowId).then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
