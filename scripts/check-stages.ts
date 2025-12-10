import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function check() {
  const contactedSnapshot = await db.collection('contacted_agents').get();
  console.log('Total contacted_agents:', contactedSnapshot.size);

  // Count unique stages
  const stages: Record<string, number> = {};
  const interestedExamples: any[] = [];

  for (const doc of contactedSnapshot.docs) {
    const data = doc.data();
    const stage = data.stage || 'undefined';
    stages[stage] = (stages[stage] || 0) + 1;

    // Collect examples of "Interested" stage
    if (stage.toLowerCase().includes('interested') && interestedExamples.length < 5) {
      interestedExamples.push({
        id: doc.id,
        address: data.propertyAddress,
        stage: data.stage,
        status: data.status,
      });
    }
  }

  console.log('\nStages breakdown:');
  Object.entries(stages)
    .sort((a, b) => b[1] - a[1])
    .forEach(([stage, count]) => {
      console.log(`  ${JSON.stringify(stage)}: ${count}`);
    });

  if (interestedExamples.length > 0) {
    console.log('\nExample "Interested" properties:');
    interestedExamples.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.address}`);
      console.log(`     Stage: ${JSON.stringify(p.stage)}`);
      console.log(`     Status: ${p.status}`);
    });
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
