import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Typesense from 'typesense';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

const tsClient = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || '', port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY || '',
});

async function main() {
  console.log('='.repeat(60));
  console.log('SYNC HEALTH CHECK: Firestore ↔ Typesense');
  console.log('='.repeat(60));

  // ==========================================
  // 1. COUNT COMPARISON
  // ==========================================
  console.log('\n=== 1. COUNT COMPARISON ===\n');

  const [fsActiveOF, fsActiveCash, fsTotalActive, fsTotalAll, fsInactive] = await Promise.all([
    db.collection('properties').where('isActive', '==', true).where('isOwnerfinance', '==', true).count().get(),
    db.collection('properties').where('isActive', '==', true).where('isCashDeal', '==', true).count().get(),
    db.collection('properties').where('isActive', '==', true).count().get(),
    db.collection('properties').count().get(),
    db.collection('properties').where('isActive', '==', false).count().get(),
  ]);

  const tsCollection = await tsClient.collections('properties').retrieve();
  const tsActiveOF = await tsClient.collections('properties').documents().search({
    q: '*', filter_by: 'isActive:=true && dealType:=[owner_finance, both]', per_page: 0,
  });
  const tsActiveCash = await tsClient.collections('properties').documents().search({
    q: '*', filter_by: 'isActive:=true && dealType:=[cash_deal, both]', per_page: 0,
  });
  const tsActive = await tsClient.collections('properties').documents().search({
    q: '*', filter_by: 'isActive:=true', per_page: 0,
  });
  const tsInactive = await tsClient.collections('properties').documents().search({
    q: '*', filter_by: 'isActive:=false', per_page: 0,
  });

  console.log('                        Firestore    Typesense    Diff');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  Total docs            ${String(fsTotalAll.data().count).padStart(8)}    ${String(tsCollection.num_documents).padStart(9)}    ${tsCollection.num_documents - fsTotalAll.data().count}`);
  console.log(`  Active (all)          ${String(fsTotalActive.data().count).padStart(8)}    ${String(tsActive.found).padStart(9)}    ${tsActive.found - fsTotalActive.data().count}`);
  console.log(`  Inactive              ${String(fsInactive.data().count).padStart(8)}    ${String(tsInactive.found).padStart(9)}    ${tsInactive.found - fsInactive.data().count}`);
  console.log(`  Active owner finance  ${String(fsActiveOF.data().count).padStart(8)}    ${String(tsActiveOF.found).padStart(9)}    ${tsActiveOF.found - fsActiveOF.data().count}`);
  console.log(`  Active cash deals     ${String(fsActiveCash.data().count).padStart(8)}    ${String(tsActiveCash.found).padStart(9)}    ${tsActiveCash.found - fsActiveCash.data().count}`);

  // ==========================================
  // 2. CHECK INACTIVE PROPERTIES IN TYPESENSE (should have isActive:false OR be deleted)
  // ==========================================
  console.log('\n=== 2. INACTIVE PROPERTY SYNC CHECK ===\n');

  // Sample 50 recently deactivated Firestore properties and check if Typesense reflects it
  const recentlyInactive = await db.collection('properties')
    .where('isActive', '==', false)
    .limit(50)
    .get();

  let tsStillActive = 0;
  let tsCorrectlyInactive = 0;
  let tsNotFound = 0;
  let tsErrors = 0;
  const outOfSyncDocs: string[] = [];

  for (const doc of recentlyInactive.docs) {
    const zpid = doc.data().zpid;
    if (!zpid) continue;
    // Use Firestore doc ID (zpid_ prefix) which matches Typesense ID format
    const tsId = doc.id;

    try {
      const tsDoc = await tsClient.collections('properties').documents(tsId).retrieve() as any;
      if (tsDoc.isActive === true) {
        tsStillActive++;
        outOfSyncDocs.push(`zpid=${tsId}: Firestore=inactive, Typesense=ACTIVE (${doc.data().fullAddress || doc.data().address || '?'})`);
      } else {
        tsCorrectlyInactive++;
      }
    } catch (err: any) {
      if (err.httpStatus === 404) {
        // Not in Typesense at all - that's OK for old properties
        tsNotFound++;
      } else {
        tsErrors++;
      }
    }
  }

  console.log(`  Checked: ${recentlyInactive.size} inactive Firestore properties`);
  console.log(`  Correctly inactive in Typesense: ${tsCorrectlyInactive}`);
  console.log(`  Not in Typesense (OK for old): ${tsNotFound}`);
  console.log(`  STILL ACTIVE in Typesense: ${tsStillActive} ← PROBLEM if > 0`);
  console.log(`  Errors: ${tsErrors}`);

  if (outOfSyncDocs.length > 0) {
    console.log('\n  Out-of-sync documents:');
    outOfSyncDocs.slice(0, 10).forEach(d => console.log(`    ${d}`));
  }

  // ==========================================
  // 3. CHECK ACTIVE PROPERTIES EXIST IN TYPESENSE
  // ==========================================
  console.log('\n=== 3. ACTIVE PROPERTY PRESENCE CHECK ===\n');

  const recentlyActive = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(50)
    .get();

  let tsHasActive = 0;
  let tsMissingActive = 0;
  const missingFromTs: string[] = [];

  for (const doc of recentlyActive.docs) {
    const zpid = doc.data().zpid;
    if (!zpid) continue;
    // Use Firestore doc ID (zpid_ prefix) which matches Typesense ID format
    const tsId = doc.id;

    try {
      await tsClient.collections('properties').documents(tsId).retrieve();
      tsHasActive++;
    } catch (err: any) {
      if (err.httpStatus === 404) {
        tsMissingActive++;
        missingFromTs.push(`zpid=${tsId}: ${doc.data().fullAddress || doc.data().address || '?'}, ${doc.data().city}, ${doc.data().state}`);
      }
    }
  }

  console.log(`  Checked: ${recentlyActive.size} active Firestore properties`);
  console.log(`  Found in Typesense: ${tsHasActive}`);
  console.log(`  MISSING from Typesense: ${tsMissingActive} ← PROBLEM if > 0`);

  if (missingFromTs.length > 0) {
    console.log('\n  Missing from Typesense:');
    missingFromTs.slice(0, 10).forEach(d => console.log(`    ${d}`));
  }

  // ==========================================
  // 4. CHECK CLOUD FUNCTION (Firestore trigger → Typesense)
  // ==========================================
  console.log('\n=== 4. CLOUD FUNCTION STATUS ===\n');

  // Check if the Cloud Function is deployed by looking at recent Typesense updates
  // that should have been triggered by Firestore writes
  const tsRecentSearch = await tsClient.collections('properties').documents().search({
    q: '*',
    sort_by: 'updatedAt:desc',
    per_page: 5,
    filter_by: 'isActive:=true',
  });

  console.log('  Most recently updated Typesense docs:');
  tsRecentSearch.hits?.forEach((h: any) => {
    const d = h.document;
    console.log(`    ${d.address}, ${d.city}, ${d.state} | updated=${d.updatedAt} | dealType=${d.dealType}`);
  });

  // ==========================================
  // 5. CHECK FOR ORPHANED TYPESENSE DOCS
  // ==========================================
  console.log('\n=== 5. ORPHAN CHECK (Typesense docs not in Firestore) ===\n');

  // Get 50 random Typesense docs and verify they exist in Firestore
  const tsSample = await tsClient.collections('properties').documents().search({
    q: '*',
    per_page: 50,
    sort_by: 'listPrice:desc',
  });

  let orphans = 0;
  let verified = 0;

  for (const hit of (tsSample.hits || [])) {
    const tsDoc = hit.document as any;
    const docId = `zpid_${tsDoc.zpid || tsDoc.id}`;
    const fsDoc = await db.collection('properties').doc(docId).get();
    if (!fsDoc.exists) {
      orphans++;
      if (orphans <= 5) {
        console.log(`  ORPHAN: zpid=${tsDoc.zpid} | ${tsDoc.address}, ${tsDoc.city} (in Typesense but NOT in Firestore)`);
      }
    } else {
      verified++;
    }
  }

  console.log(`  Checked: ${(tsSample.hits || []).length} Typesense docs`);
  console.log(`  Verified in Firestore: ${verified}`);
  console.log(`  Orphans (Typesense only): ${orphans}`);

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(60));
  console.log('SYNC HEALTH SUMMARY');
  console.log('='.repeat(60));

  const issues: string[] = [];

  const countDiff = Math.abs(tsActive.found - fsTotalActive.data().count);
  if (countDiff > 50) {
    issues.push(`Active count mismatch: Firestore=${fsTotalActive.data().count} vs Typesense=${tsActive.found} (diff=${countDiff})`);
  }
  if (tsStillActive > 0) {
    issues.push(`${tsStillActive} inactive Firestore properties are still active in Typesense`);
  }
  if (tsMissingActive > 0) {
    issues.push(`${tsMissingActive} active Firestore properties are missing from Typesense`);
  }
  if (orphans > 0) {
    issues.push(`${orphans} Typesense documents have no matching Firestore document`);
  }

  if (issues.length === 0) {
    console.log('\n  HEALTHY - No sync issues detected');
  } else {
    console.log(`\n  ${issues.length} ISSUE(S) FOUND:`);
    issues.forEach(i => console.log(`    - ${i}`));
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
