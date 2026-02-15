/**
 * Cleanup: Fix all remaining audit issues
 *
 * 1. Deactivate 287 properties with no deal type
 * 2. Flag 12 suspicious discount properties (< 50% Zestimate)
 * 3. Deactivate 2 foreclosures marked active
 * 4. Flag 21 properties priced > 2x Zestimate
 *
 * Usage: npx tsx scripts/cleanup-remaining-issues.ts
 * Dry run: npx tsx scripts/cleanup-remaining-issues.ts --dry-run
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

interface FixAction {
  id: string;
  address: string;
  price: number;
  category: string;
  action: 'deactivate' | 'flag';
  detail: string;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('CLEANUP: Fix all remaining audit issues');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const snapshot = await db.collection('properties').get();
  console.log(`Total properties: ${snapshot.size}\n`);

  const actions: FixAction[] = [];

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const id = doc.id;
    const addr = d.streetAddress || d.address || d.fullAddress || '?';
    const price = d.price || d.listPrice || 0;
    const zestimate = d.zestimate || d.estimate || d.estimatedValue || 0;

    // === 1. No deal type — deactivate ===
    if (!d.isOwnerFinance && !d.isCashDeal) {
      actions.push({
        id, address: addr, price,
        category: 'NO_DEAL_TYPE',
        action: 'deactivate',
        detail: 'Neither owner finance nor cash deal',
      });
      continue; // No need to check other issues
    }

    // === 2. Foreclosures/not-for-sale marked active — deactivate ===
    const homeStatus = (d.homeStatus || '').toUpperCase();
    if (homeStatus && homeStatus !== 'FOR_SALE' && d.isActive !== false) {
      actions.push({
        id, address: addr, price,
        category: 'NOT_FOR_SALE',
        action: 'deactivate',
        detail: `homeStatus="${d.homeStatus}"`,
      });
      continue;
    }

    // === 3. Suspicious discount (< 50% Zestimate) — flag ===
    if (price > 0 && zestimate > 0 && price < zestimate * 0.5) {
      const pct = ((price / zestimate) * 100).toFixed(1);
      actions.push({
        id, address: addr, price,
        category: 'SUSPICIOUS_DISCOUNT',
        action: 'flag',
        detail: `$${price.toLocaleString()} is ${pct}% of $${zestimate.toLocaleString()} Zestimate`,
      });
    }

    // === 4. Price > 2x Zestimate — flag ===
    if (price > 0 && zestimate > 0 && price > zestimate * 2) {
      const pct = ((price / zestimate) * 100).toFixed(0);
      actions.push({
        id, address: addr, price,
        category: 'OVERPRICED',
        action: 'flag',
        detail: `$${price.toLocaleString()} is ${pct}% of $${zestimate.toLocaleString()} Zestimate`,
      });
    }
  }

  // Group by category
  const byCategory = new Map<string, FixAction[]>();
  for (const a of actions) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category)!.push(a);
  }

  const deactivateActions = actions.filter(a => a.action === 'deactivate');
  const flagActions = actions.filter(a => a.action === 'flag');

  console.log('--- SUMMARY ---');
  for (const [cat, catActions] of byCategory) {
    const action = catActions[0].action;
    console.log(`  ${cat}: ${catActions.length} (${action})`);
  }
  console.log(`\nTotal to deactivate: ${deactivateActions.length}`);
  console.log(`Total to flag: ${flagActions.length}`);

  // Print details
  for (const [cat, catActions] of byCategory) {
    console.log(`\n--- ${cat} (${catActions.length}) ---`);
    for (const a of catActions.slice(0, 10)) {
      console.log(`  [${a.action.toUpperCase()}] ${a.id} ($${a.price.toLocaleString()}) — ${a.detail}`);
    }
    if (catActions.length > 10) console.log(`  ... and ${catActions.length - 10} more`);
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — no changes.');
    return;
  }

  // === APPLY DEACTIVATIONS ===
  if (deactivateActions.length > 0) {
    console.log(`\nDeactivating ${deactivateActions.length} properties...`);
    const BATCH_SIZE = 400;
    for (let i = 0; i < deactivateActions.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = deactivateActions.slice(i, i + BATCH_SIZE);
      for (const a of chunk) {
        batch.update(db.collection('properties').doc(a.id), {
          isActive: false,
          deactivatedReason: a.category,
          updatedAt: new Date(),
        });
      }
      await batch.commit();
      console.log(`  Deactivated ${Math.min(i + BATCH_SIZE, deactivateActions.length)}/${deactivateActions.length}`);
    }

    // Remove deactivated from Typesense
    console.log('Removing deactivated from Typesense...');
    let tsRemoved = 0;
    for (const a of deactivateActions) {
      try {
        await typesenseClient.collections('properties').documents(a.id).delete();
        tsRemoved++;
      } catch (err: any) {
        if (err.httpStatus !== 404) {
          console.error(`  Failed: ${a.id}:`, err.message);
        }
      }
    }
    console.log(`  Typesense: removed ${tsRemoved}`);
  }

  // === APPLY FLAGS ===
  if (flagActions.length > 0) {
    console.log(`\nFlagging ${flagActions.length} properties...`);
    const BATCH_SIZE = 400;
    for (let i = 0; i < flagActions.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = flagActions.slice(i, i + BATCH_SIZE);
      for (const a of chunk) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (a.category === 'SUSPICIOUS_DISCOUNT') {
          updateData.suspiciousDiscount = true;
          updateData.needsReview = true;
          updateData.reviewReasons = admin.firestore.FieldValue.arrayUnion(`Price < 50% Zestimate: ${a.detail}`);
        }
        if (a.category === 'OVERPRICED') {
          updateData.overpriced = true;
          updateData.needsReview = true;
          updateData.reviewReasons = admin.firestore.FieldValue.arrayUnion(`Price > 2x Zestimate: ${a.detail}`);
        }
        batch.update(db.collection('properties').doc(a.id), updateData);
      }
      await batch.commit();
      console.log(`  Flagged ${Math.min(i + BATCH_SIZE, flagActions.length)}/${flagActions.length}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('CLEANUP COMPLETE');
  console.log(`  Deactivated: ${deactivateActions.length}`);
  console.log(`  Flagged for review: ${flagActions.length}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error).finally(() => process.exit(0));
