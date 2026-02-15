/**
 * Fix: Remove isCashDeal=true from properties with no Zestimate
 *
 * These were falsely tagged during the Dec 2025 apify-rebuild migration.
 * If a property has no Zestimate, it CANNOT be a valid cash deal
 * (the whole point is price < 80% of Zestimate).
 *
 * Also strips from dealTypes array. If no deal types remain and the property
 * isn't owner finance, marks it inactive.
 *
 * Usage: npx tsx scripts/fix-false-cash-deals.ts
 * Dry run: npx tsx scripts/fix-false-cash-deals.ts --dry-run
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
  console.log('FIX: Remove false cash deal tags (no Zestimate)');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all cash deals
  const snapshot = await db.collection('properties')
    .where('isCashDeal', '==', true)
    .get();

  console.log(`Total cash deals: ${snapshot.size}`);

  const zestFields = ['zestimate', 'estimate', 'estimatedValue', 'homeValue'];
  const toFix: Array<{ id: string; address: string; price: number; isOwnerFinance: boolean; isActive: boolean }> = [];
  const toDeactivate: Array<{ id: string; address: string; price: number }> = [];

  for (const doc of snapshot.docs) {
    const d = doc.data();

    // Check if any Zestimate field has a value
    let hasZestimate = false;
    for (const field of zestFields) {
      if (d[field] && d[field] > 0) {
        hasZestimate = true;
        break;
      }
    }

    if (hasZestimate) continue; // Valid cash deal, skip

    const addr = d.streetAddress || d.address || d.fullAddress || '?';
    const price = d.price || d.listPrice || 0;

    toFix.push({
      id: doc.id,
      address: addr,
      price,
      isOwnerFinance: !!d.isOwnerFinance,
      isActive: d.isActive !== false,
    });

    // If it's not owner finance either, it has no reason to exist
    if (!d.isOwnerFinance) {
      toDeactivate.push({ id: doc.id, address: addr, price });
    }
  }

  console.log(`\nFalse cash deals (no Zestimate): ${toFix.length}`);
  console.log(`  - Also owner finance (will keep, just untag cash deal): ${toFix.length - toDeactivate.length}`);
  console.log(`  - No deal type after fix (will deactivate): ${toDeactivate.length}`);

  if (toFix.length === 0) {
    console.log('\nNothing to fix!');
    return;
  }

  if (DRY_RUN) {
    console.log('\nSample of properties to fix:');
    for (const item of toFix.slice(0, 15)) {
      const action = item.isOwnerFinance ? 'untag cash deal' : 'untag + deactivate';
      console.log(`  ${item.id} — $${item.price.toLocaleString()} — ${item.address} [${action}]`);
    }
    console.log('\nDRY RUN — no changes. Run without --dry-run to apply.');
    return;
  }

  // Apply fixes in batches
  console.log('\nApplying fixes...');
  const BATCH_SIZE = 400;

  for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toFix.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const ref = db.collection('properties').doc(item.id);

      if (item.isOwnerFinance) {
        // Keep as owner finance, just remove cash deal tag
        batch.update(ref, {
          isCashDeal: false,
          dealTypes: ['owner_finance'],
          cashDealReason: admin.firestore.FieldValue.delete(),
          discountPercentage: admin.firestore.FieldValue.delete(),
          eightyPercentOfZestimate: admin.firestore.FieldValue.delete(),
          updatedAt: new Date(),
        });
      } else {
        // No deal type left — deactivate
        batch.update(ref, {
          isCashDeal: false,
          dealTypes: [],
          isActive: false,
          cashDealReason: admin.firestore.FieldValue.delete(),
          discountPercentage: admin.firestore.FieldValue.delete(),
          eightyPercentOfZestimate: admin.firestore.FieldValue.delete(),
          updatedAt: new Date(),
        });
      }
    }

    await batch.commit();
    console.log(`  Fixed ${Math.min(i + BATCH_SIZE, toFix.length)}/${toFix.length}`);
  }

  // Update Typesense for deactivated properties (remove from search)
  console.log('\nRemoving deactivated properties from Typesense...');
  let tsRemoved = 0;
  for (const item of toDeactivate) {
    try {
      await typesenseClient.collections('properties').documents(item.id).delete();
      tsRemoved++;
    } catch (err: any) {
      if (err.httpStatus !== 404) {
        console.error(`  Failed to remove ${item.id}:`, err.message);
      }
    }
  }

  // Update Typesense for re-tagged properties (update dealType)
  console.log('Updating re-tagged properties in Typesense...');
  let tsUpdated = 0;
  const ownerFinanceOnly = toFix.filter(f => f.isOwnerFinance);
  for (const item of ownerFinanceOnly) {
    try {
      await typesenseClient.collections('properties').documents(item.id).update({
        dealType: 'owner_finance',
      });
      tsUpdated++;
    } catch (err: any) {
      if (err.httpStatus !== 404) {
        console.error(`  Failed to update ${item.id}:`, err.message);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('FIX COMPLETE');
  console.log(`  Firestore: ${toFix.length} untagged as cash deal`);
  console.log(`  Deactivated (no deal type left): ${toDeactivate.length}`);
  console.log(`  Typesense removed: ${tsRemoved}`);
  console.log(`  Typesense updated: ${tsUpdated}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error).finally(() => process.exit(0));
