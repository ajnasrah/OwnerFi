import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function verifyFinalState() {
  const propertiesSnapshot = await db.collection('properties').get();

  const withOppId = [];
  const withoutOppId = [];
  const bySource: Record<string, number> = {};

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();
    const source = data.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;

    if (data.opportunityId) {
      withOppId.push({ id: doc.id, oppId: data.opportunityId, address: data.address, city: data.city });
    } else {
      withoutOppId.push({ id: doc.id, address: data.address, city: data.city, source: data.source });
    }
  });

  console.log(`\n📊 Final Firebase State:\n`);
  console.log(`Total properties: ${propertiesSnapshot.size}`);
  console.log(`Properties with Opportunity IDs: ${withOppId.length}`);
  console.log(`Properties WITHOUT Opportunity IDs: ${withoutOppId.length}`);

  console.log(`\n📌 By Source:`);
  Object.entries(bySource).forEach(([source, count]) => {
    console.log(`   ${source}: ${count}`);
  });

  if (withoutOppId.length > 0) {
    console.log(`\n⚠️  Properties still without Opportunity IDs:`);
    withoutOppId.forEach((prop, idx) => {
      console.log(`   ${idx + 1}. ${prop.address}, ${prop.city} (Source: ${prop.source})`);
    });
  }

  console.log(`\n✅ Database sync complete!`);
  console.log(`Expected: ~525 from GHL + ${withoutOppId.length} without OppID = ${525 + withoutOppId.length}`);
  console.log(`Actual: ${propertiesSnapshot.size}`);
}

verifyFinalState().catch(console.error);
