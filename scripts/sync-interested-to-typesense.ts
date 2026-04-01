/**
 * Sync all 84 "Interested" properties to Typesense
 * Also deactivates any newly created properties that are already sold/off-market
 *
 * Usage: npx tsx scripts/sync-interested-to-typesense.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ApifyClient } from 'apify-client';
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

// The 16 newly created ZPIDs — need to verify they're still for sale
const NEWLY_CREATED_ZPIDS = [
  '42225272', '321484', '62865780', '461185096', '90078420',
  '99433885', '263104', '82700881', '42252590', '76143930',
  '103800897', '42154166', '341731', '42144324', '338437',
  '460928092',
];

// The 68 that already existed
const EXISTING_ZPIDS = [
  '42127611', '450678393', '315238', '89322899', '42168218', '297805', '276774',
  '298359', '62864541', '42253899', '42293518', '42129258', '161659201', '42174317',
  '123709217', '460459726', '42129791', '42227520', '42346296', '42294008', '296684',
  '460404003', '114174832', '448602915', '2087243688', '390877', '42142558', '275784',
  '42178965', '321706', '310490', '340945', '81070451', '446666157', '42145694',
  '42196001', '42225442', '79783662', '35734753', '455212883', '41811854', '362271',
  '63255689', '314021', '72449648', '42212613', '42230119', '42322966', '355248',
  '89278865', '94725291', '42130008', '55302375', '273802', '2064449382', '458697011',
  '2064459952', '279654', '42155191', '316168', '41812416', '2098195913', '458491460',
  '76144132', '68520892', '89267669', '42212183', '324577',
];

async function main() {
  console.log('=== STEP 1: Check newly created properties for sold/off-market status ===\n');

  const docsToCheck: Array<{ docId: string; url: string; zpid: string }> = [];

  for (const zpid of NEWLY_CREATED_ZPIDS) {
    const docId = `zpid_${zpid}`;
    const doc = await db.collection('properties').doc(docId).get();
    if (doc.exists) {
      const data = doc.data()!;
      const url = data.url || `https://www.zillow.com/homedetails/${zpid}_zpid/`;
      docsToCheck.push({ docId, url, zpid });
    }
  }

  console.log(`Checking ${docsToCheck.length} newly created properties on Zillow...\n`);

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
  const run = await client.actor('maxcopell/zillow-detail-scraper').call({
    startUrls: docsToCheck.map(p => ({ url: p.url })),
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const zpidToResult = new Map<string, any>();
  for (const item of items as any[]) {
    const zpid = String(item.zpid || item.id || '');
    if (zpid) zpidToResult.set(zpid, item);
  }

  const inactiveStatuses = ['PENDING', 'SOLD', 'RECENTLY_SOLD', 'OFF_MARKET', 'FOR_RENT', 'CONTINGENT', 'OTHER'];
  let deactivated = 0;
  let stillActive = 0;
  let noResult = 0;

  for (const { docId, zpid } of docsToCheck) {
    const result = zpidToResult.get(zpid);

    if (!result) {
      await db.collection('properties').doc(docId).update({
        isActive: false,
        offMarketReason: 'No Apify result (likely off-market)',
        lastStatusCheck: new Date(),
      });
      console.log(`  ✗ ${docId} — No result (deactivated)`);
      deactivated++;
      noResult++;
      continue;
    }

    const status = result.homeStatus || 'UNKNOWN';
    const hasNoPrice = !result.price && !result.listPrice;

    if (inactiveStatuses.includes(status) || hasNoPrice) {
      await db.collection('properties').doc(docId).update({
        isActive: false,
        homeStatus: status,
        offMarketReason: `Status: ${status}`,
        lastStatusCheck: new Date(),
      });
      console.log(`  ✗ ${docId} — ${status} (deactivated)`);
      deactivated++;
    } else {
      await db.collection('properties').doc(docId).update({
        homeStatus: status,
        price: result.listPrice || result.price || 0,
        listPrice: result.listPrice || result.price || 0,
        zestimate: result.zestimate || null,
        lastStatusCheck: new Date(),
      });
      console.log(`  ✓ ${docId} — ${status} (still active)`);
      stillActive++;
    }
  }

  console.log(`\nNewly created: ${docsToCheck.length} | Active: ${stillActive} | Deactivated: ${deactivated} | No result: ${noResult}\n`);

  // === STEP 2: Sync all properties to Typesense ===
  console.log('=== STEP 2: Sync properties to Typesense ===\n');

  const { indexRawFirestoreProperty, deletePropertyFromIndex } = await import('../src/lib/typesense/sync');

  const allZpids = [...NEWLY_CREATED_ZPIDS, ...EXISTING_ZPIDS];

  let indexed = 0;
  let removed = 0;
  let errors = 0;

  for (const zpid of allZpids) {
    const docId = `zpid_${zpid}`;
    try {
      const doc = await db.collection('properties').doc(docId).get();
      if (!doc.exists) continue;

      const data = doc.data()!;

      if (data.isActive === false) {
        try {
          await deletePropertyFromIndex(docId);
          removed++;
        } catch {
          // May not exist in index
        }
      } else {
        await indexRawFirestoreProperty(docId, data, 'properties');
        indexed++;
      }
    } catch (err: any) {
      console.error(`  Error syncing ${docId}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Typesense: Indexed ${indexed} active | Removed ${removed} inactive | Errors ${errors}`);
  console.log('\nDone! Active OF properties should now appear on the investor dashboard.');
}

main().catch(console.error);
