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
  const props = await db.collection('properties')
    .where('source', '==', 'agent_outreach')
    .get();

  console.log('\n=== PROPERTIES FROM AGENT OUTREACH ===');
  console.log('Total:', props.size);

  props.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ✅ ${d.address} | ownerFinanceVerified: ${d.ownerFinanceVerified} | isActive: ${d.isActive}`);
  });
}

check().then(() => process.exit(0));
