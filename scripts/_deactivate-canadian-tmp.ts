/**
 * Deactivate 6 active Canadian-province listings that leaked past the state regex
 * (audit #5 finding). Also removes them from Typesense search index.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';
import { deletePropertyFromIndex } from '../src/lib/typesense/sync';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

const CANADIAN_PROVINCES = new Set(['ON','BC','SK','AB','NS','MB','QC','NL','NT','NU','PE','YT','NB']);

async function main() {
  console.log('Finding active Canadian-province docs...');
  const snap = await db.collection('properties').where('isActive', '==', true).get();
  const toDeactivate: string[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const state = (d.state || '').trim().toUpperCase();
    if (CANADIAN_PROVINCES.has(state)) toDeactivate.push(doc.id);
  }
  console.log(`Found ${toDeactivate.length} docs to deactivate`);
  for (const id of toDeactivate) console.log('  ' + id);

  if (toDeactivate.length === 0) return;

  // Deactivate in Firestore
  const batch = db.batch();
  for (const id of toDeactivate) {
    batch.update(db.collection('properties').doc(id), {
      isActive: false,
      deactivationReason: 'non-us-location',
      deactivatedAt: new Date(),
    });
  }
  await batch.commit();
  console.log(`✅ Deactivated ${toDeactivate.length} in Firestore`);

  // Remove from Typesense
  let removed = 0;
  for (const id of toDeactivate) {
    const ok = await deletePropertyFromIndex(id);
    if (ok) removed++;
  }
  console.log(`✅ Removed ${removed}/${toDeactivate.length} from Typesense`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
