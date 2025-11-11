import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function main() {
  console.log('🔍 Checking property_videos collection\n');

  const snapshot = await db.collection('property_videos')
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get();

  if (snapshot.empty) {
    console.log('⚠️  Collection is EMPTY\n');
    return;
  }

  console.log(`📊 Found ${snapshot.size} recent documents\n`);

  const statuses: Record<string, number> = {};
  const stuckDocs: any[] = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const status = data.status || 'unknown';
    statuses[status] = (statuses[status] || 0) + 1;

    const isProcessing = status.includes('processing') || status === 'pending';
    if (isProcessing && data.updatedAt) {
      const hoursSince = (Date.now() - data.updatedAt) / (1000 * 60 * 60);
      if (hoursSince > 1) {
        stuckDocs.push({
          id: doc.id,
          status,
          hoursSince: hoursSince.toFixed(1),
          address: data.address || 'No address',
          heygenVideoId: data.heygenVideoId,
          submagicJobId: data.submagicJobId
        });
      }
    }
  });

  console.log('📈 Status Breakdown:');
  Object.entries(statuses).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  if (stuckDocs.length > 0) {
    console.log(`\n🚨 STUCK WORKFLOWS: ${stuckDocs.length}`);
    stuckDocs.forEach((doc, i) => {
      console.log(`\n   ${i + 1}. ID: ${doc.id}`);
      console.log(`      Status: ${doc.status}`);
      console.log(`      Stuck for: ${doc.hoursSince} hours`);
      console.log(`      Address: ${doc.address.substring(0, 50)}...`);
      if (doc.heygenVideoId) console.log(`      HeyGen ID: ${doc.heygenVideoId}`);
      if (doc.submagicJobId) console.log(`      Submagic ID: ${doc.submagicJobId}`);
    });
  } else {
    console.log('\n✅ No stuck workflows');
  }
}

main();
