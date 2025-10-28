import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

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

async function diagnoseStuckProperties() {
  console.log('🔍 Diagnosing stuck property workflows...\n');

  // Get workflows stuck in posting (can't order by createdAt without index)
  const q = query(
    collection(db, 'property_videos'),
    where('status', '==', 'posting'),
    limit(10)
  );

  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.size} workflows stuck in 'posting' status\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('━'.repeat(80));
    console.log(`📄 Workflow ID: ${doc.id}`);
    console.log(`   Property: ${data.address}, ${data.city}, ${data.state}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Created: ${new Date(data.createdAt).toLocaleString()}`);
    console.log(`   Updated: ${new Date(data.updatedAt || data.createdAt).toLocaleString()}`);
    console.log(`   Status Changed: ${data.statusChangedAt ? new Date(data.statusChangedAt).toLocaleString() : 'N/A'}`);
    console.log();
    console.log('   📹 HeyGen Data:');
    console.log(`      Video ID: ${data.heygenVideoId || 'MISSING'}`);
    console.log(`      Video URL: ${data.heygenVideoUrl ? 'Present' : 'MISSING'}`);
    console.log();
    console.log('   ✨ Submagic Data:');
    console.log(`      Project ID: ${data.submagicProjectId || 'MISSING'}`);
    console.log(`      Download URL: ${data.submagicDownloadUrl ? 'Present' : 'MISSING'}`);
    console.log();
    console.log('   ☁️  R2 Storage:');
    console.log(`      Final Video URL: ${data.finalVideoUrl || 'MISSING'}`);
    console.log();
    console.log('   📱 Late API:');
    console.log(`      Post ID: ${data.latePostId || 'Not posted yet'}`);
    console.log();
    console.log('   🔄 Retry Info:');
    console.log(`      Retry Count: ${data.retryCount || 0}`);
    console.log(`      Last Retry: ${data.lastRetryAt ? new Date(data.lastRetryAt).toLocaleString() : 'Never'}`);
    console.log();

    // Diagnose the issue
    console.log('   🩺 DIAGNOSIS:');
    const issues = [];

    if (!data.heygenVideoId) {
      issues.push('❌ Missing HeyGen video ID - workflow may not have completed HeyGen processing');
    }

    if (!data.submagicProjectId) {
      issues.push('❌ Missing Submagic project ID - Submagic may not have been triggered');
    }

    if (!data.submagicDownloadUrl) {
      issues.push('⚠️  Missing Submagic download URL - Submagic webhook may not have fired');
    }

    if (!data.finalVideoUrl) {
      issues.push('❌ CRITICAL: Missing final video URL - video was never uploaded to R2');
      issues.push('   → This is why posting is stuck - no video URL to post!');
    } else {
      issues.push('✅ Video uploaded to R2 successfully');
      if (!data.latePostId) {
        issues.push('❌ CRITICAL: Has video URL but no Late post ID');
        issues.push('   → Late API posting failed or never attempted');
      }
    }

    if (issues.length === 0) {
      issues.push('❓ Unclear - all data present but still stuck');
    }

    issues.forEach(issue => console.log(`      ${issue}`));
    console.log();
  }

  console.log('━'.repeat(80));
  console.log('\n💡 RECOMMENDED ACTIONS:');
  console.log('   1. If "Missing final video URL": Trigger /api/process-video manually');
  console.log('   2. If "Has video URL but no Late post ID": Late API is failing');
  console.log('   3. If "Missing Submagic download URL": Submagic webhook didnt fire');
  console.log('   4. Check if check-stuck-posting cron is actually running');
  console.log('   5. Check Late API credentials and profile IDs\n');
}

diagnoseStuckProperties().catch(console.error);
