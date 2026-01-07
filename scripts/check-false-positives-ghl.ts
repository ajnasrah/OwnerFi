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

const falsePositiveZpids = [
  'zpid_2064449382',
  'zpid_2098195913',
  'zpid_273802',
  'zpid_279654',
  'zpid_316168',
  'zpid_324577',
  'zpid_41812416',
  'zpid_42155191',
  'zpid_42212183',
  'zpid_42323347',
  'zpid_458697011',
  'zpid_55302375',
  'zpid_68520892',
  'zpid_72569564',
  'zpid_76144132',
  'zpid_89267669',
];

async function checkGHL() {
  console.log('Checking if false positives are GHL properties...\n');

  let ghlCount = 0;
  let regionalCount = 0;

  for (const docId of falsePositiveZpids) {
    const doc = await db.collection('properties').doc(docId).get();
    if (doc.exists) {
      const data = doc.data()!;
      const isGHL = data.sentToGHL === true;
      const isRegional = data.isRegional === true;

      if (isGHL) ghlCount++;
      if (isRegional) regionalCount++;

      const zpid = docId.replace('zpid_', '');
      const zillowUrl = `https://www.zillow.com/homedetails/${zpid}_zpid/`;

      console.log(`${docId}`);
      console.log(`  Address: ${data.fullAddress || data.streetAddress || 'N/A'}`);
      console.log(`  Price: $${data.price?.toLocaleString() || 'N/A'}`);
      console.log(`  sentToGHL: ${data.sentToGHL || false}`);
      console.log(`  isRegional: ${data.isRegional || false}`);
      console.log(`  isCashDeal: ${data.isCashDeal || false}`);
      console.log(`  isOwnerFinance: ${data.isOwnerFinance || false}`);
      console.log(`  source: ${data.source || 'unknown'}`);
      console.log(`  Zillow: ${zillowUrl}`);
      console.log('');
    }
  }

  console.log('='.repeat(50));
  console.log(`Total false positives: ${falsePositiveZpids.length}`);
  console.log(`Sent to GHL: ${ghlCount}`);
  console.log(`Regional properties: ${regionalCount}`);
}

checkGHL().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
