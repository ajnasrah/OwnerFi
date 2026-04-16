import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  // Try zpid_904492 first (what backfill showed earlier)
  const direct = await db.collection('properties').doc('zpid_904492').get();
  console.log(`properties/zpid_904492 exists: ${direct.exists}`);
  if (direct.exists) {
    const d = direct.data()!;
    console.log(`  address: ${d.address}  city: ${d.city}  state: ${d.state}`);
    console.log(`  isActive: ${d.isActive}  homeStatus: ${d.homeStatus}  status: ${d.status}`);
    console.log(`  isOwnerfinance: ${d.isOwnerfinance}  dealTypes: ${JSON.stringify(d.dealTypes)}`);
    console.log(`  source: ${d.source}  ownerFinanceVerified: ${d.ownerFinanceVerified}`);
    console.log(`  agentConfirmedOwnerfinance: ${d.agentConfirmedOwnerfinance}`);
    console.log(`  primaryImage: ${d.primaryImage ? 'YES' : 'NO'}`);
    console.log(`  agentConfirmedAt: ${d.agentConfirmedAt?.toDate?.() || d.agentConfirmedAt}`);
    console.log(`  originalQueueId: ${d.originalQueueId}`);
  }

  // Query by zpid for any other matches
  const byZpid = await db.collection('properties').where('zpid', '==', '904492').get();
  console.log(`\nAll docs with zpid=904492: ${byZpid.size}`);
  byZpid.docs.forEach(d => console.log(`  ${d.id}`));

  // Search for 1617 5th addresses
  console.log(`\n=== Search city NW-ish for 1617 5th ===`);
  const searches = [
    { city: 'Center Point', state: 'AL' }, // guess
    { city: 'Birmingham', state: 'AL' },
    { city: 'Nashville', state: 'TN' },
    { city: 'Canton', state: 'OH' },
  ];
  // Instead, query by streetAddress prefix
  const anySnap = await db.collection('properties').where('streetAddress', '==', '1617 5th St NW').get();
  console.log(`where streetAddress=='1617 5th St NW': ${anySnap.size}`);
  anySnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id} ${d.city} ${d.state} | isActive=${d.isActive} isOwnerfinance=${d.isOwnerfinance} dealTypes=${JSON.stringify(d.dealTypes)}`);
  });

  const anySnap2 = await db.collection('properties').where('address', '==', '1617 5th St NW').get();
  console.log(`where address=='1617 5th St NW': ${anySnap2.size}`);
  anySnap2.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id} ${d.city} ${d.state} | isActive=${d.isActive} isOwnerfinance=${d.isOwnerfinance} dealTypes=${JSON.stringify(d.dealTypes)} source=${d.source}`);
  });

  // Check queue too
  console.log(`\n=== Queue docs for 1617 5th St NW ===`);
  const qSnap = await db.collection('agent_outreach_queue').where('address', '==', '1617 5th St NW').get();
  qSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id}: status=${d.status} response=${d.agentResponse} routedTo=${d.routedTo} zpid=${d.zpid} city=${d.city} ${d.state}`);
    console.log(`    agentResponseAt: ${d.agentResponseAt?.toDate?.() || d.agentResponseAt}`);
    console.log(`    updatedAt: ${d.updatedAt?.toDate?.() || d.updatedAt}`);
    console.log(`    ghlOpportunityId: ${d.ghlOpportunityId}`);
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
