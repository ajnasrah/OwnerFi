/**
 * Cleanup: Delete properties with missing/empty addresses
 *
 * Usage: npx tsx scripts/cleanup-no-address.ts
 * Dry run: npx tsx scripts/cleanup-no-address.ts --dry-run
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
  })
});

const db = admin.firestore();

const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY || process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('CLEANUP: Properties with missing/empty addresses');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const snapshot = await db.collection('properties').get();
  console.log(`Total properties: ${snapshot.size}\n`);

  const toDelete: Array<{ id: string; reason: string; price: number }> = [];

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const addr = d.streetAddress || d.address || d.fullAddress || '';
    const city = d.city || '';
    const state = d.state || '';

    // No address at all
    if (!addr || addr.trim() === '' || addr.trim() === ', ,' || addr.trim() === ',') {
      toDelete.push({ id: doc.id, reason: `Empty address (addr="${addr}")`, price: d.price || 0 });
      continue;
    }

    // Placeholder/privacy-listed address from Zillow
    if (/\b(undisclosed|hidden|private|not\s*disclosed|no\s+address|confidential|unlisted|restricted)\b/i.test(addr)) {
      toDelete.push({ id: doc.id, reason: `Placeholder address (addr="${addr}")`, price: d.price || 0 });
      continue;
    }

    // No city or state
    if (!city || !state) {
      toDelete.push({ id: doc.id, reason: `Missing city="${city}" state="${state}" (addr="${addr}")`, price: d.price || 0 });
      continue;
    }
  }

  console.log(`Found ${toDelete.length} properties with missing addresses\n`);

  if (toDelete.length === 0) {
    console.log('Nothing to clean up!');
    return;
  }

  for (const item of toDelete.slice(0, 20)) {
    console.log(`  ${item.id} ($${item.price.toLocaleString()}) — ${item.reason}`);
  }
  if (toDelete.length > 20) console.log(`  ... and ${toDelete.length - 20} more`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — no changes.');
    return;
  }

  // Delete from Firestore
  console.log('\nDeleting from Firestore...');
  const BATCH_SIZE = 400;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      batch.delete(db.collection('properties').doc(item.id));
    }
    await batch.commit();
    console.log(`  Deleted ${Math.min(i + BATCH_SIZE, toDelete.length)}/${toDelete.length}`);
  }

  // Delete from Typesense
  console.log('Deleting from Typesense...');
  let tsDeleted = 0;
  for (const item of toDelete) {
    try {
      await typesenseClient.collections('properties').documents(item.id).delete();
      tsDeleted++;
    } catch (err: any) {
      if (err.httpStatus !== 404) {
        console.error(`  Failed: ${item.id}:`, err.message);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('CLEANUP COMPLETE');
  console.log(`  Firestore: ${toDelete.length} deleted`);
  console.log(`  Typesense: ${tsDeleted} deleted`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error).finally(() => process.exit(0));
