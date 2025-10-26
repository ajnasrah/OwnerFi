import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function checkRecentVideos() {
  console.log('🔍 Checking recent property video workflows...\n');

  // Get recent property videos (last 10)
  const recentVideos = await db
    .collection('property_videos')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (recentVideos.empty) {
    console.log('❌ No property video workflows found');
    return;
  }

  console.log(`Found ${recentVideos.size} recent workflows:\n`);

  recentVideos.forEach((doc, index) => {
    const data = doc.data();
    const date = new Date(data.createdAt);
    console.log(`${index + 1}. ${data.address || 'Unknown address'}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Created: ${date.toLocaleString()}`);
    console.log(`   Variant: ${data.variant || 'N/A'}`);
    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
    }
    console.log('');
  });

  // Count by status
  const statuses: Record<string, number> = {};
  recentVideos.forEach(doc => {
    const status = doc.data().status;
    statuses[status] = (statuses[status] || 0) + 1;
  });

  console.log('📊 Status breakdown:');
  Object.entries(statuses).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
}

checkRecentVideos()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
