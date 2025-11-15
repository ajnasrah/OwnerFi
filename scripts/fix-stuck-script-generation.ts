/**
 * Fix podcast workflows stuck in script_generation status
 * These get stuck when the script is generated but HeyGen API call fails
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

async function fixStuckScriptGeneration() {
  console.log('\n🔍 Finding workflows stuck in script_generation...\n');

  const q = query(
    collection(db, 'podcast_workflow_queue'),
    where('status', '==', 'script_generation')
  );

  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.size} workflows stuck in script_generation\n`);

  if (snapshot.size === 0) {
    console.log('✅ No stuck workflows found!\n');
    return;
  }

  let deleted = 0;
  let failed = 0;
  let tooRecent = 0;

  for (const workflowDoc of snapshot.docs) {
    const data = workflowDoc.data();
    const workflowId = workflowDoc.id;
    const createdAt = data.createdAt || 0;
    const ageMinutes = Math.round((Date.now() - createdAt) / 60000);
    const ageHours = Math.round(ageMinutes / 60);

    console.log(`\n📄 ${workflowId}`);
    console.log(`   Episode: #${data.episodeNumber} - ${data.episodeTitle || 'No title'}`);
    console.log(`   Guest: ${data.guestName || 'Unknown'}`);
    console.log(`   Age: ${ageHours}h (${ageMinutes}min)`);
    console.log(`   Status: ${data.status}`);

    // Only fix workflows older than 30 minutes
    if (ageMinutes < 30) {
      console.log(`   ⏭️  Too recent - skipping`);
      tooRecent++;
      continue;
    }

    // These workflows failed during HeyGen API call
    // Best approach: delete them and let the system create new ones
    try {
      await deleteDoc(doc(db, 'podcast_workflow_queue', workflowId));
      console.log(`   ✅ Deleted (system will create new episode)`);
      deleted++;
    } catch (error) {
      console.error(`   ❌ Error deleting:`, error);
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Total stuck: ${snapshot.size}`);
  console.log(`   Deleted: ${deleted}`);
  console.log(`   Too recent (skipped): ${tooRecent}`);
  console.log(`   Failed: ${failed}`);
  console.log('\n💡 Note: Deleted workflows will be regenerated automatically');
  console.log('   by the next cron run.\n');
}

fixStuckScriptGeneration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
