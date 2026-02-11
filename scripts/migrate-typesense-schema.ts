/**
 * Typesense Schema Migration + Backfill
 *
 * 1. Diffs the live Typesense schema against code-defined schema
 * 2. PATCHes any missing fields (no downtime, no data loss)
 * 3. Backfills isLand on all existing documents from Firestore data
 *
 * Usage: npx tsx scripts/migrate-typesense-schema.ts
 *
 * Safe to run multiple times — PATCHing existing fields is a no-op,
 * and backfill uses upsert so it's idempotent.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

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
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: parseInt(process.env.TYPESENSE_PORT || '443'),
    protocol: process.env.TYPESENSE_PROTOCOL || 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

const COLLECTION_NAME = 'properties';

// The full schema as defined in code (src/lib/typesense/schemas.ts)
// We only need the fields array for diffing
const DEFINED_FIELDS = [
  { name: 'address', type: 'string' },
  { name: 'city', type: 'string', facet: true },
  { name: 'state', type: 'string', facet: true },
  { name: 'zipCode', type: 'string' },
  { name: 'description', type: 'string', optional: true },
  { name: 'title', type: 'string', optional: true },
  { name: 'location', type: 'geopoint', optional: true },
  { name: 'dealType', type: 'string', facet: true },
  { name: 'listPrice', type: 'int32', facet: true },
  { name: 'monthlyPayment', type: 'int32', optional: true },
  { name: 'downPaymentAmount', type: 'int32', optional: true },
  { name: 'downPaymentPercent', type: 'float', optional: true },
  { name: 'bedrooms', type: 'int32', facet: true },
  { name: 'bathrooms', type: 'float', facet: true },
  { name: 'squareFeet', type: 'int32', optional: true },
  { name: 'yearBuilt', type: 'int32', optional: true },
  { name: 'zestimate', type: 'int32', optional: true },
  { name: 'discountPercent', type: 'float', optional: true },
  { name: 'percentOfArv', type: 'float', optional: true },
  { name: 'rentEstimate', type: 'int32', optional: true },
  { name: 'annualTaxAmount', type: 'float', optional: true },
  { name: 'propertyTaxRate', type: 'float', optional: true },
  { name: 'monthlyHoa', type: 'int32', optional: true },
  { name: 'daysOnZillow', type: 'int32', optional: true },
  { name: 'isActive', type: 'bool', facet: true },
  { name: 'ownerFinanceVerified', type: 'bool', optional: true },
  { name: 'needsWork', type: 'bool', optional: true },
  { name: 'isLand', type: 'bool', optional: true },
  { name: 'manuallyVerified', type: 'bool', optional: true },
  { name: 'sourceType', type: 'string', facet: true, optional: true },
  { name: 'propertyType', type: 'string', facet: true },
  { name: 'financingType', type: 'string', facet: true, optional: true },
  { name: 'homeStatus', type: 'string', facet: true, optional: true },
  { name: 'zpid', type: 'string', optional: true },
  { name: 'url', type: 'string', optional: true },
  { name: 'primaryImage', type: 'string', optional: true },
  { name: 'galleryImages', type: 'string[]', optional: true },
  { name: 'agentName', type: 'string', optional: true },
  { name: 'agentPhone', type: 'string', optional: true },
  { name: 'agentEmail', type: 'string', optional: true },
  { name: 'interestRate', type: 'float', optional: true },
  { name: 'termYears', type: 'int32', optional: true },
  { name: 'balloonYears', type: 'int32', optional: true },
  { name: 'createdAt', type: 'int64' },
  { name: 'updatedAt', type: 'int64', optional: true },
  { name: 'nearbyCities', type: 'string[]', optional: true },
  { name: 'ownerFinanceKeywords', type: 'string[]', optional: true },
];

// ============================
// STEP 1: Schema Diff + PATCH
// ============================
async function patchSchema() {
  console.log('\n' + '='.repeat(60));
  console.log('  STEP 1: SCHEMA DIFF + PATCH');
  console.log('='.repeat(60) + '\n');

  // Get live schema
  const liveCollection = await typesenseClient.collections(COLLECTION_NAME).retrieve();
  const liveFieldNames = new Set(
    (liveCollection.fields || []).map((f: any) => f.name)
  );

  console.log(`Live collection has ${liveFieldNames.size} fields`);
  console.log(`Code defines ${DEFINED_FIELDS.length} fields\n`);

  // Find missing fields
  const missingFields = DEFINED_FIELDS.filter(f => !liveFieldNames.has(f.name));

  if (missingFields.length === 0) {
    console.log('Schema is already up to date — no fields to add.\n');
    return;
  }

  console.log(`Missing fields to add: ${missingFields.map(f => `${f.name} (${f.type})`).join(', ')}\n`);

  // PATCH the collection
  await typesenseClient.collections(COLLECTION_NAME).update({
    fields: missingFields
  });

  console.log(`Successfully PATCHed ${missingFields.length} field(s) into '${COLLECTION_NAME}'`);

  // Verify
  const updated = await typesenseClient.collections(COLLECTION_NAME).retrieve();
  const updatedFieldNames = new Set(
    (updated.fields || []).map((f: any) => f.name)
  );

  for (const field of missingFields) {
    const status = updatedFieldNames.has(field.name) ? 'OK' : 'MISSING';
    console.log(`  ${field.name}: ${status}`);
  }
  console.log('');
}

// ============================
// STEP 2: Backfill isLand
// ============================
async function backfillIsLand() {
  console.log('\n' + '='.repeat(60));
  console.log('  STEP 2: BACKFILL isLand ON EXISTING DOCUMENTS');
  console.log('='.repeat(60) + '\n');

  // Fetch all active properties from Firestore
  console.log('Fetching properties from Firestore...');
  const snapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .get();

  console.log(`Found ${snapshot.size} active properties\n`);

  if (snapshot.size === 0) {
    console.log('No properties to backfill');
    return;
  }

  // Build partial update documents (only id + isLand)
  const updates: { id: string; isLand: boolean }[] = [];
  let landCount = 0;

  snapshot.docs.forEach((doc: any) => {
    const data = doc.data();
    const LAND_TYPES = new Set(['land', 'lot', 'lots', 'vacant_land', 'farm', 'ranch']);
    const isLand = data.isLand === true
      || LAND_TYPES.has((data.homeType || data.propertyType || '').toLowerCase());

    if (isLand) landCount++;
    updates.push({ id: doc.id, isLand });
  });

  console.log(`Land properties detected: ${landCount}`);
  console.log(`Non-land properties: ${updates.length - landCount}\n`);

  // Batch update via Typesense import with "update" action (partial update)
  const BATCH_SIZE = 100;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    try {
      const results = await typesenseClient.collections(COLLECTION_NAME)
        .documents()
        .import(batch, { action: 'emplace' });

      for (const result of results) {
        if (result.success) {
          success++;
        } else {
          failed++;
          // Only log first few failures
          if (failed <= 5) {
            console.error('  Update error:', result.error);
          }
        }
      }

      const progress = Math.min(i + BATCH_SIZE, updates.length);
      process.stdout.write(`\r  Progress: ${progress}/${updates.length} (${success} ok, ${failed} failed)`);
    } catch (err: any) {
      console.error(`\n  Batch failed:`, err.message);
      failed += batch.length;
    }
  }

  console.log('\n');
  console.log(`Backfill complete: ${success} updated, ${failed} failed`);
}

// ============================
// MAIN
// ============================
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  TYPESENSE SCHEMA MIGRATION');
  console.log('  Safe, idempotent — can run multiple times');
  console.log('='.repeat(60));

  await patchSchema();
  await backfillIsLand();

  console.log('\n' + '='.repeat(60));
  console.log('  MIGRATION COMPLETE');
  console.log('='.repeat(60) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Migration failed:', e); process.exit(1); });
