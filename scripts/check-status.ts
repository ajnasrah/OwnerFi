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

async function check() {
  console.log('\n--- agent_outreach_queue statuses ---');
  const queueSnap = await db.collection('agent_outreach_queue').limit(200).get();
  const statuses: Record<string, number> = {};
  queueSnap.forEach(d => {
    const s = d.data().status || 'no_status';
    statuses[s] = (statuses[s] || 0) + 1;
  });
  console.log(statuses);

  // Check one property I just activated
  console.log('\n--- Sample activated property ---');
  const prop = await db.collection('properties').doc('zpid_66660131').get();
  if (prop.exists) {
    const d = prop.data()!;
    console.log({
      address: d.address,
      isActive: d.isActive,
      status: d.status,
      homeStatus: d.homeStatus,
      ownerFinanceVerified: d.ownerFinanceVerified,
      dealTypes: d.dealTypes,
    });
  } else {
    console.log('Property not found - checking first activated...');
    const first = await db.collection('properties').where('originalQueueId', '==', 'la1BjnzLremS4ebdEZiG').get();
    if (!first.empty) {
      const d = first.docs[0].data();
      console.log('Found:', first.docs[0].id);
      console.log({
        address: d.address,
        isActive: d.isActive,
        status: d.status,
        homeStatus: d.homeStatus,
      });
    }
  }
}

check().then(() => process.exit(0));
