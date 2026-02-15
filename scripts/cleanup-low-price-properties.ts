/**
 * Cleanup: Remove properties with garbage prices (< $10,000)
 *
 * These are $1 auctions, "contact for price" placeholders, and data errors
 * that slipped through before the minimum price validation was added.
 *
 * Deletes from both Firestore and Typesense.
 *
 * Usage: npx tsx scripts/cleanup-low-price-properties.ts
 * Dry run: npx tsx scripts/cleanup-low-price-properties.ts --dry-run
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

const MIN_PRICE = 10_000;
const DRY_RUN = process.argv.includes('--dry-run');

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Initialize Typesense
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
  console.log(`CLEANUP: Properties with price < $${MIN_PRICE.toLocaleString()}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE — will delete!'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Query Firestore for properties with price < MIN_PRICE
  const snapshot = await db.collection('properties')
    .where('price', '<', MIN_PRICE)
    .get();

  console.log(`Found ${snapshot.size} properties with price < $${MIN_PRICE.toLocaleString()}\n`);

  if (snapshot.size === 0) {
    console.log('Nothing to clean up!');
    return;
  }

  // Show what we'd delete
  const toDelete: Array<{ id: string; address: string; price: number }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const price = data.price || 0;
    const address = data.streetAddress || data.fullAddress || doc.id;
    toDelete.push({ id: doc.id, address, price });
    console.log(`  $${price.toLocaleString().padStart(10)} — ${address} (${doc.id})`);
  }

  console.log(`\nTotal: ${toDelete.length} properties to delete\n`);

  if (DRY_RUN) {
    console.log('DRY RUN — no changes made. Run without --dry-run to delete.');
    return;
  }

  // Delete from Firestore in batches
  console.log('Deleting from Firestore...');
  const BATCH_SIZE = 400;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      batch.delete(db.collection('properties').doc(item.id));
    }
    await batch.commit();
    console.log(`  Deleted ${Math.min(i + BATCH_SIZE, toDelete.length)}/${toDelete.length} from Firestore`);
  }

  // Delete from Typesense
  console.log('Deleting from Typesense...');
  let tsDeleted = 0;
  let tsFailed = 0;
  for (const item of toDelete) {
    try {
      await typesenseClient.collections('properties').documents(item.id).delete();
      tsDeleted++;
    } catch (err: any) {
      if (err.httpStatus === 404) {
        // Not in Typesense, that's fine
      } else {
        tsFailed++;
        console.error(`  Failed to delete ${item.id} from Typesense:`, err.message);
      }
    }
  }
  console.log(`  Typesense: deleted ${tsDeleted}, not found/skipped ${toDelete.length - tsDeleted - tsFailed}, failed ${tsFailed}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CLEANUP COMPLETE`);
  console.log(`  Firestore: ${toDelete.length} deleted`);
  console.log(`  Typesense: ${tsDeleted} deleted`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(console.error).finally(() => process.exit(0));
