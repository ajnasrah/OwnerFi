import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();
const ts = getTypesenseAdminClient();

async function checkProperty(label: string, streetContains: string, city?: string, state?: string) {
  console.log(`\n${'='.repeat(60)}\n${label}\n${'='.repeat(60)}`);

  // Find in Firestore — try queue first since most recent
  const queues = city && state
    ? await db.collection('agent_outreach_queue').where('city', '==', city).where('state', '==', state).get()
    : await db.collection('agent_outreach_queue').get();

  const qMatches: any[] = [];
  for (const doc of queues.docs) {
    const d = doc.data();
    const addr = (d.address || '').toLowerCase();
    if (addr.includes(streetContains.toLowerCase())) qMatches.push({ id: doc.id, ...d });
  }
  console.log(`Queue matches: ${qMatches.length}`);
  for (const m of qMatches) {
    console.log(`\n  Queue doc: ${m.id}`);
    console.log(`    address: ${m.address}, ${m.city}, ${m.state}`);
    console.log(`    status: ${m.status}  response: ${m.agentResponse}`);
    console.log(`    agentResponseAt: ${m.agentResponseAt?.toDate?.() || m.agentResponseAt}`);
    console.log(`    updatedAt: ${m.updatedAt?.toDate?.() || m.updatedAt}`);
    console.log(`    routedTo: ${m.routedTo}`);
    console.log(`    zpid: ${m.zpid}  (type: ${typeof m.zpid})`);
    console.log(`    ghlOpportunityId: ${m.ghlOpportunityId}`);
    console.log(`    imgSrc: ${m.imgSrc || '(none)'}`);
    console.log(`    firstPropertyImage: ${m.firstPropertyImage || '(none)'}`);

    if (m.zpid) {
      const propId = `zpid_${m.zpid}`;
      const p = await db.collection('properties').doc(propId).get();
      console.log(`\n    Firestore properties/${propId}: ${p.exists ? 'EXISTS' : 'MISSING'}`);
      if (p.exists) {
        const d = p.data()!;
        console.log(`      isActive: ${d.isActive}  isOwnerfinance: ${d.isOwnerfinance}`);
        console.log(`      dealTypes: ${JSON.stringify(d.dealTypes)}`);
        console.log(`      source: ${d.source}  homeStatus: ${d.homeStatus}`);
        console.log(`      primaryImage: ${d.primaryImage || '(none)'}`);
        console.log(`      firstPropertyImage: ${d.firstPropertyImage || '(none)'}`);
        console.log(`      agentConfirmedAt: ${d.agentConfirmedAt?.toDate?.() || d.agentConfirmedAt}`);
      }

      if (ts) {
        try {
          const t: any = await ts.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents(propId).retrieve();
          console.log(`\n    Typesense/${propId}: EXISTS`);
          console.log(`      isActive: ${t.isActive}  dealType: ${t.dealType}`);
          console.log(`      primaryImage: ${t.primaryImage || '(none)'}`);
        } catch (e: any) {
          console.log(`\n    Typesense/${propId}: MISSING (${e.message?.slice(0, 80)})`);
        }
      }
    }
  }
}

async function main() {
  await checkProperty('1950 Johnson St', '1950 johnson');
  await checkProperty('530 5th St, Montgomery, AL', '530 5th', 'Montgomery', 'AL');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
