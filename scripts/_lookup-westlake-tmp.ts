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

const ZPID = '460701363';

async function main() {
  // 1) Search by zpid
  const byZpid = await db.collection('properties').where('zpid', '==', ZPID).get();
  console.log(`By zpid "${ZPID}": ${byZpid.size} matches`);
  for (const doc of byZpid.docs) dump(doc);

  // Try numeric
  const byZpidNum = await db.collection('properties').where('zpid', '==', Number(ZPID)).get();
  console.log(`By zpid ${ZPID} (number): ${byZpidNum.size} matches`);
  for (const doc of byZpidNum.docs) dump(doc);

  // 2) Search by city
  const byCity = await db.collection('properties')
    .where('city', '==', 'Bessemer')
    .where('state', '==', 'AL')
    .get();
  console.log(`\nBessemer AL properties: ${byCity.size}`);
  for (const doc of byCity.docs) {
    const d = doc.data();
    const addr = (d.address || d.streetAddress || '').toLowerCase();
    if (addr.includes('westlake') || addr.includes('1015')) {
      console.log('--- Possible match ---');
      dump(doc);
    }
  }

  // 3) Check agent outreach collection
  console.log('\n=== agent_outreach ===');
  const outreach = await db.collection('agent_outreach')
    .where('zpid', '==', ZPID)
    .get();
  console.log(`agent_outreach by zpid "${ZPID}": ${outreach.size}`);
  for (const doc of outreach.docs) {
    console.log('Doc ID:', doc.id, JSON.stringify(doc.data(), null, 2).slice(0, 800));
  }

  const outreachNum = await db.collection('agent_outreach')
    .where('zpid', '==', Number(ZPID))
    .get();
  console.log(`agent_outreach by zpid ${ZPID} (num): ${outreachNum.size}`);
  for (const doc of outreachNum.docs) {
    console.log('Doc ID:', doc.id, JSON.stringify(doc.data(), null, 2).slice(0, 800));
  }
}

function dump(doc: FirebaseFirestore.DocumentSnapshot) {
  const d = doc.data() as any;
  if (!d) return;
  console.log('\n>>> Doc ID:', doc.id);
  console.log('  address:', d.address || d.streetAddress);
  console.log('  city/state/zip:', d.city, d.state, d.zipCode);
  console.log('  zpid:', d.zpid);
  console.log('  price/listPrice:', d.price, d.listPrice);
  console.log('  estimate (Zestimate):', d.estimate);
  console.log('  dealTypes:', d.dealTypes);
  console.log('  isOwnerFinance:', d.isOwnerFinance);
  console.log('  ownerFinance:', d.ownerFinance);
  console.log('  financing:', d.financing);
  console.log('  homeStatus:', d.homeStatus);
  console.log('  hdpUrl:', d.hdpUrl);
  console.log('  url:', d.url);
  console.log('  source:', d.source);
  console.log('  agentResponse:', d.agentResponse);
  console.log('  agentResponseAt:', d.agentResponseAt?.toDate?.() || d.agentResponseAt);
  console.log('  ghlSent:', d.ghlSent);
  console.log('  ghlSentAt:', d.ghlSentAt?.toDate?.() || d.ghlSentAt);
  console.log('  ghlContactId:', d.ghlContactId);
  console.log('  outreachStatus:', d.outreachStatus);
  console.log('  isActive:', d.isActive);
  console.log('  deletedAt:', d.deletedAt);
  console.log('  createdAt:', d.createdAt?.toDate?.() || d.createdAt);
  console.log('  lastScrapedAt:', d.lastScrapedAt?.toDate?.() || d.lastScrapedAt);
  console.log('  uploadedVia:', d.uploadedVia);
  console.log('  uploadedBy:', d.uploadedBy);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
