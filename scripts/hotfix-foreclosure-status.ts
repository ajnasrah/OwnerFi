/**
 * Hotfix: tag all properties whose `homeStatus` is already FORECLOSED /
 * PRE_FORECLOSURE / FORECLOSURE / FOR_AUCTION as distressed. Strips
 * `isOwnerfinance` + removes `owner_finance` from `dealTypes` on any doc
 * where we have confirmed distressed status.
 *
 * Requires no Apify calls — uses the homeStatus field already in Firestore.
 * Also patches the Typesense schema (idempotent) and updates Typesense docs.
 *
 * Usage:
 *   npx tsx scripts/hotfix-foreclosure-status.ts --dry-run
 *   npx tsx scripts/hotfix-foreclosure-status.ts
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
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY || process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 15,
});

const DISTRESSED_STATUSES = ['FOR_AUCTION', 'FORECLOSED', 'FORECLOSURE', 'PRE_FORECLOSURE'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NEW_FIELDS: any[] = [
  { name: 'isAuction', type: 'bool', facet: true, optional: true },
  { name: 'isForeclosure', type: 'bool', facet: true, optional: true },
  { name: 'isBankOwned', type: 'bool', facet: true, optional: true },
  { name: 'listingSubType', type: 'string', facet: true, optional: true },
];

function statusToLabel(status: string) {
  const s = status.toUpperCase();
  if (s === 'FOR_AUCTION') return { isAuction: true, isForeclosure: false, isBankOwned: false, listingSubType: 'Auction' };
  if (s === 'FORECLOSED' || s === 'FORECLOSURE') return { isAuction: false, isForeclosure: true, isBankOwned: false, listingSubType: 'Foreclosure' };
  if (s === 'PRE_FORECLOSURE') return { isAuction: false, isForeclosure: true, isBankOwned: false, listingSubType: 'Pre-foreclosure' };
  return { isAuction: false, isForeclosure: false, isBankOwned: false, listingSubType: '' };
}

async function patchTypesenseSchema() {
  console.log('Patching Typesense schema with new fields...');
  try {
    const live = await ts.collections('properties').retrieve();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = new Set((live.fields || []).map((f: any) => f.name));
    const missing = NEW_FIELDS.filter(f => !existing.has(f.name));
    if (missing.length === 0) {
      console.log('  schema up to date\n');
      return;
    }
    console.log(`  adding: ${missing.map(f => f.name).join(', ')}`);
    if (!DRY_RUN) {
      await ts.collections('properties').update({ fields: missing });
      console.log('  patched\n');
    } else {
      console.log('  DRY-RUN (skipped)\n');
    }
  } catch (err) {
    console.error('  schema patch failed:', err);
    throw err;
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HOTFIX: tag properties with distressed homeStatus`);
  console.log(`Mode:   ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  await patchTypesenseSchema();

  const snap = await db.collection('properties')
    .where('homeStatus', 'in', DISTRESSED_STATUSES)
    .get();

  console.log(`Found ${snap.size} properties with distressed homeStatus\n`);
  if (snap.size === 0) return;

  let flagged = 0;
  let strippedOf = 0;
  let errors = 0;
  const firestoreBatch = db.batch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tsUpdates: any[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snap.docs.forEach((doc: any) => {
    const data = doc.data();
    const labels = statusToLabel(data.homeStatus);
    const wasOf = data.isOwnerfinance === true;
    const alreadyTagged =
      data.isAuction === labels.isAuction &&
      data.isForeclosure === labels.isForeclosure &&
      data.isBankOwned === labels.isBankOwned &&
      data.listingSubType === labels.listingSubType;

    console.log(
      `  [${data.homeStatus.padEnd(16)}] $${String(data.price || 0).padStart(8)}  ${data.streetAddress || data.fullAddress || doc.id}` +
      (wasOf ? '  🚨 was isOwnerfinance=true' : '') +
      (alreadyTagged ? '  (already tagged)' : '')
    );

    const update: Record<string, unknown> = {
      isAuction: labels.isAuction,
      isForeclosure: labels.isForeclosure,
      isBankOwned: labels.isBankOwned,
      listingSubType: labels.listingSubType,
      hotfixedAt: new Date(),
    };

    // Strip OF tagging on confirmed distressed listings
    update.isOwnerfinance = false;
    update.dealTypes = admin.firestore.FieldValue.arrayRemove('owner_finance');

    firestoreBatch.update(doc.ref, update);
    flagged++;
    if (wasOf) strippedOf++;

    tsUpdates.push({
      id: doc.id,
      isAuction: labels.isAuction,
      isForeclosure: labels.isForeclosure,
      isBankOwned: labels.isBankOwned,
      listingSubType: labels.listingSubType,
    });
  });

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would flag ${flagged} (strip OF from ${strippedOf})\n`);
    return;
  }

  try {
    await firestoreBatch.commit();
    console.log(`\nFirestore: updated ${flagged}`);
  } catch (err) {
    console.error('Firestore batch commit failed:', err);
    errors++;
  }

  if (tsUpdates.length > 0) {
    try {
      const jsonl = tsUpdates.map(u => JSON.stringify(u)).join('\n');
      await ts.collections('properties').documents().import(jsonl, { action: 'update' });
      console.log(`Typesense: updated ${tsUpdates.length}`);
    } catch (err) {
      console.error('Typesense import failed:', err);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Flagged:       ${flagged}`);
  console.log(`Stripped OF:   ${strippedOf}`);
  console.log(`Errors:        ${errors}`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
