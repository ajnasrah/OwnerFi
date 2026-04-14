// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

const typesense = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443, protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

const ALLOWED = new Set(['FOR_SALE','FOR_AUCTION','FORECLOSURE','FORECLOSED','PRE_FORECLOSURE']);

async function main() {
  const { db } = getFirebaseAdmin();
  const chunks: string[][] = [];
  for (let i=0; i<TARGETED_CASH_ZIPS.length; i+=30) chunks.push(TARGETED_CASH_ZIPS.slice(i, i+30));

  const ofDocs: Array<{docId: string, zpid: string, address: string, zip: string, homeStatus: string, isActive: boolean}> = [];
  for (const chunk of chunks) {
    const snap = await db.collection('properties').where('zipCode','in',chunk).where('isOwnerfinance','==',true).get();
    snap.forEach(doc => {
      const d = doc.data();
      ofDocs.push({
        docId: doc.id,
        zpid: d.zpid || doc.id,
        address: d.streetAddress || d.fullAddress || '',
        zip: d.zipCode || '',
        homeStatus: String(d.homeStatus||'').toUpperCase(),
        isActive: d.isActive !== false,
      });
    });
  }

  console.log(`OF-flagged in 59 zips (Firestore): ${ofDocs.length}\n`);

  const byStatus: Record<string, number> = {};
  ofDocs.forEach(p => { byStatus[p.homeStatus || '(empty)'] = (byStatus[p.homeStatus || '(empty)']||0)+1; });
  console.log('By homeStatus:');
  Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).forEach(([s,c])=>console.log(`  ${s}: ${c}`));

  // Check Typesense presence
  let inTS = 0, notInTS = 0;
  const badInTS: typeof ofDocs = [];
  for (const p of ofDocs) {
    try {
      await typesense.collections('properties').documents(p.docId).retrieve();
      inTS++;
      if (p.homeStatus && !ALLOWED.has(p.homeStatus)) badInTS.push(p);
    } catch (e: any) {
      if (e.httpStatus === 404) notInTS++;
    }
  }
  console.log(`\nIn Typesense:   ${inTS}`);
  console.log(`Not in Typesense: ${notInTS}`);
  console.log(`BAD (in Typesense but non-active homeStatus): ${badInTS.length}`);
  badInTS.forEach(p => console.log(`  ${p.homeStatus} | ${p.zpid} | ${p.address} (${p.zip}) | docId=${p.docId}`));
}

main().catch(e => { console.error(e); process.exit(1); });
