/**
 * Cleanup: any active property with a distressed flag
 * (isAuction / isForeclosure / isBankOwned) that still has
 * isOwnerfinance=true or 'owner_finance' in dealTypes gets stripped.
 * Distressed listings are never owner-finance by definition.
 *
 * Also mirrors the fix to Typesense with dealType='cash_deal'.
 *
 * Usage:
 *   npx tsx scripts/strip-of-from-distressed.ts --dry-run
 *   npx tsx scripts/strip-of-from-distressed.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const ts = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST, port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY || process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 15,
});

async function main() {
  console.log(`\nSTRIP OF FROM DISTRESSED — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const [a, f, b] = await Promise.all([
    db.collection('properties').where('isAuction', '==', true).get(),
    db.collection('properties').where('isForeclosure', '==', true).get(),
    db.collection('properties').where('isBankOwned', '==', true).get(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>();
  [...a.docs, ...f.docs, ...b.docs].forEach(d => { if (!byId.has(d.id)) byId.set(d.id, d); });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offenders: any[] = [];
  byId.forEach(doc => {
    const data = doc.data();
    const hasOf = data.isOwnerfinance === true
      || (Array.isArray(data.dealTypes) && data.dealTypes.includes('owner_finance'));
    if (hasOf) offenders.push(doc);
  });

  console.log(`Scanned ${byId.size} distressed docs, found ${offenders.length} with lingering OF tags.\n`);
  if (offenders.length === 0) return;

  const batch = db.batch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tsUpdates: any[] = [];

  for (const doc of offenders) {
    const d = doc.data();
    const label = d.listingSubType || (d.isAuction ? 'Auction' : d.isBankOwned ? 'Bank Owned' : 'Foreclosure');
    console.log(`  [${label.padEnd(14)}] ${d.streetAddress || doc.id}  isOF=${d.isOwnerfinance}  dealTypes=${JSON.stringify(d.dealTypes || [])}`);

    batch.update(doc.ref, {
      isOwnerfinance: false,
      dealTypes: admin.firestore.FieldValue.arrayRemove('owner_finance'),
      stripOfAt: new Date(),
    });

    tsUpdates.push({
      id: doc.id,
      // Typesense dealType — distressed is always cash_deal
      dealType: 'cash_deal',
    });
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would strip OF from ${offenders.length}\n`);
    return;
  }

  await batch.commit();
  console.log(`\nFirestore: stripped OF from ${offenders.length}`);

  if (tsUpdates.length > 0) {
    const jsonl = tsUpdates.map(u => JSON.stringify(u)).join('\n');
    const result = await ts.collections('properties').documents().import(jsonl, { action: 'update' });
    const lines = String(result).split('\n');
    let ok = 0, bad = 0;
    lines.forEach((line, i) => {
      try { if (JSON.parse(line).success) ok++; else { bad++; console.error(`  TS fail line ${i}: ${line}`); } }
      catch { bad++; }
    });
    console.log(`Typesense: ${ok} ok, ${bad} failed`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
