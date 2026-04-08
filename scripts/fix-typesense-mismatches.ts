import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getTypesenseAdminClient, getTypesenseSearchClient } from '../src/lib/typesense/client';

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
const adminClient = getTypesenseAdminClient()!;
const searchClient = getTypesenseSearchClient()!;

async function fix() {
  console.log('Finding Typesense ↔ Firestore mismatches...\n');

  // Build set of Firestore owner finance IDs
  const fsSnap = await db.collection('properties').where('isActive', '==', true).get();
  const fsOFIds = new Set<string>();
  const fsData = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of fsSnap.docs) {
    const d = doc.data();
    fsData.set(doc.id, d);
    if (d.isOwnerfinance === true) fsOFIds.add(doc.id);
  }
  console.log('Firestore OF properties:', fsOFIds.size);

  // Find TS owner_finance properties not in Firestore OF set
  let page = 1;
  let fixed = 0;
  let deleted = 0;

  while (true) {
    const batch = await searchClient.collections('properties').documents().search({
      q: '*',
      query_by: 'city',
      filter_by: 'isActive:=true && dealType:=[owner_finance, both]',
      per_page: 250,
      page,
      include_fields: 'id,dealType',
    });
    if (!batch.hits || batch.hits.length === 0) break;

    for (const hit of batch.hits) {
      const id = (hit as any).document.id;
      if (!fsOFIds.has(id)) {
        const d = fsData.get(id);

        if (!d || d.isActive === false) {
          try {
            await adminClient.collections('properties').documents(id).delete();
            deleted++;
            console.log('Deleted from TS:', id);
          } catch (e: any) {
            if (e.httpStatus !== 404) console.error('Delete failed:', id, e.message);
          }
        } else {
          const newDealType = d.isCashDeal ? 'cash_deal' : 'unknown';
          try {
            await adminClient.collections('properties').documents(id).update({ dealType: newDealType });
            fixed++;
            console.log('Fixed:', id, '-> dealType=' + newDealType);
          } catch (e: any) {
            console.error('Update failed:', id, e.message);
          }
        }
      }
    }
    if (batch.hits.length < 250) break;
    page++;
  }

  console.log('\nDone! Fixed:', fixed, '| Deleted:', deleted);

  // Verify
  const verify = await searchClient.collections('properties').documents().search({
    q: '*', query_by: 'city',
    filter_by: 'isActive:=true && dealType:=[owner_finance, both]',
    per_page: 0,
  });
  console.log('Typesense OF count after fix:', verify.found);
  console.log('Firestore OF count:', fsOFIds.size);
  console.log('Match:', verify.found === fsOFIds.size ? '✅ YES' : '❌ NO (diff=' + ((verify.found || 0) - fsOFIds.size) + ')');
}

fix().catch(console.error);
