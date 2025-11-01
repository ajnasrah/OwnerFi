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

async function checkAbdullahHistory() {
  console.log('🔍 Checking ABDULLAH workflow history\n');

  const snapshot = await db.collection('abdullah_workflow_queue')
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();

  console.log(`Total workflows: ${snapshot.size}\n`);

  const statuses: Record<string, number> = {};
  let lastCompleted: any = null;
  let firstStuck: any = null;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const status = data.status;
    statuses[status] = (statuses[status] || 0) + 1;

    if (status === 'completed' && !lastCompleted) {
      lastCompleted = { id: doc.id, ...data };
    }

    if (status === 'heygen_processing' && !firstStuck) {
      firstStuck = { id: doc.id, ...data };
    }
  });

  console.log('📊 Status breakdown:');
  Object.entries(statuses).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  if (lastCompleted) {
    console.log(`\n✅ Last COMPLETED workflow:`);
    console.log(`   ID: ${lastCompleted.id}`);
    console.log(`   Title: ${lastCompleted.title}`);
    console.log(`   Created: ${new Date(lastCompleted.createdAt).toISOString()}`);
    console.log(`   Completed: ${new Date(lastCompleted.completedAt || lastCompleted.updatedAt).toISOString()}`);
  } else {
    console.log(`\n❌ NO COMPLETED WORKFLOWS FOUND IN LAST 30!`);
  }

  if (firstStuck) {
    console.log(`\n🚨 First STUCK workflow:`);
    console.log(`   ID: ${firstStuck.id}`);
    console.log(`   Title: ${firstStuck.title}`);
    console.log(`   Created: ${new Date(firstStuck.createdAt).toISOString()}`);
    console.log(`   HeyGen Video ID: ${firstStuck.heygenVideoId || 'None'}`);
  }

  // Show all workflows chronologically
  console.log(`\n📋 Last 15 workflows (newest first):\n`);
  snapshot.docs.slice(0, 15).forEach((doc, i) => {
    const data = doc.data();
    const created = new Date(data.createdAt).toISOString();
    console.log(`${i + 1}. [${data.status}] ${created} - ${data.title?.substring(0, 40)}...`);
  });
}

checkAbdullahHistory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
