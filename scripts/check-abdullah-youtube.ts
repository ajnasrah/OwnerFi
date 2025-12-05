/**
 * Check Abdullah YouTube posting status
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Initialize Firebase client SDK
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

async function checkAbdullahWorkflows() {
  const q = query(
    collection(db, 'abdullah_workflow_queue'),
    orderBy('createdAt', 'desc'),
    limit(5)
  );
  const snapshot = await getDocs(q);

  console.log('=== Recent Abdullah Workflows ===');
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`\n📄 ${doc.id}:`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Created: ${new Date(data.createdAt).toISOString()}`);
    console.log(`   Late Post ID: ${data.latePostId || 'N/A'}`);
    console.log(`   Platforms: ${data.postedToPlatforms?.join(', ') || 'N/A'}`);
    if (data.postResults) {
      console.log(`   Post Results: ${JSON.stringify(data.postResults).substring(0, 500)}`);
    }
    if (data.error) {
      console.log(`   Error: ${data.error}`);
    }
  });
}

checkAbdullahWorkflows().catch(console.error);
