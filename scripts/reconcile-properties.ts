/**
 * Idempotent property reconciliation pass.
 *
 * Fixes (all findable from audits 3, 4, 6 in audit-reports/):
 *   1. Normalize `homeType` (raw Zillow values → slugs)
 *   2. Set `isLand` from normalized homeType
 *   3. Recompute cash-deal math from current price + zestimate:
 *      - `eightyPercentOfZestimate`, `discountPercentage`, `priceToZestimateRatio`
 *      - `isCashDeal` (price < 80% zestimate, NOT land, valid numbers)
 *      - `isFixer` (cash deal AND gap > $150k)
 *      - Strip cash fields entirely when ineligible (land, no zestimate, no price)
 *   4. Reconcile `dealTypes` array ↔ `isOwnerfinance` / `isCashDeal` booleans:
 *      - If dealTypes populated → trust it, flip booleans to match
 *      - If dealTypes empty → rebuild from boolean flags + ownerFinanceVerified +
 *        agentConfirmedOwnerfinance + recomputed isCashDeal
 *      - Distressed listings (auction/foreclosure/bank-owned) never get owner_finance
 *   5. Re-index updated docs to Typesense
 *
 * Safe to run multiple times. Only writes diffs. DRY RUN by default.
 *
 * Usage:
 *   npx tsx scripts/reconcile-properties.ts                 # dry run (default)
 *   npx tsx scripts/reconcile-properties.ts --apply         # write changes
 *   npx tsx scripts/reconcile-properties.ts --apply --typesense  # also re-index
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';
import { normalizeHomeType } from '../src/lib/scraper-v2/property-transformer';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const RESYNC_TYPESENSE = process.argv.includes('--typesense');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx > -1 ? parseInt(process.argv[idx + 1] || '0', 10) : 0;
})();

const FIXER_GAP_THRESHOLD = 150_000;

type Changes = Record<string, { from: any; to: any }>;

interface ReconcileResult {
  id: string;
  changes: Changes;
  reasons: string[];
}

function shallowEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  }
  return false;
}

function deriveCashFields(price: number, zestimate: number, isLand: boolean) {
  if (isLand || !zestimate || zestimate <= 0 || !price || price <= 0) {
    return {
      eightyPercentOfZestimate: null,
      discountPercentage: null,
      priceToZestimateRatio: null,
      isCashDeal: false,
      isFixer: false,
      cashDealReason: null,
    };
  }
  const eighty = zestimate * 0.8;
  const disc = ((zestimate - price) / zestimate) * 100;
  const ratio = price / zestimate;
  const gap = zestimate - price;
  const isCashDeal = price < eighty;
  const isFixer = isCashDeal && gap > FIXER_GAP_THRESHOLD;
  let cashDealReason: string | null = null;
  if (isCashDeal) cashDealReason = isFixer ? 'fixer' : 'discount';
  return {
    eightyPercentOfZestimate: eighty,
    discountPercentage: disc,
    priceToZestimateRatio: ratio,
    isCashDeal,
    isFixer,
    cashDealReason,
  };
}

function reconcile(d: any): ReconcileResult {
  const id = d.id;
  const changes: Changes = {};
  const reasons: string[] = [];

  const normHt = normalizeHomeType(d.homeType);
  const isLand = normHt === 'land';

  // 1. homeType
  if (d.homeType !== normHt) {
    changes.homeType = { from: d.homeType, to: normHt };
    reasons.push('homeType normalized');
  }
  if (d.isLand !== isLand) {
    changes.isLand = { from: d.isLand, to: isLand };
    reasons.push('isLand recomputed');
  }

  // 2. Cash-deal math (use listPrice if set; else price)
  const price = Number(d.listPrice ?? d.price ?? 0) || 0;
  const zestimate = Number(d.estimate ?? d.zestimate ?? d.homeValue ?? 0) || 0;
  const cash = deriveCashFields(price, zestimate, isLand);

  // Numeric comparisons with tolerance to avoid float churn
  const closeEq = (a: any, b: any) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return Math.abs(Number(a) - Number(b)) < 0.01;
  };

  if (!closeEq(d.eightyPercentOfZestimate, cash.eightyPercentOfZestimate)) {
    changes.eightyPercentOfZestimate = { from: d.eightyPercentOfZestimate, to: cash.eightyPercentOfZestimate };
    reasons.push('eighty% recomputed');
  }
  if (!closeEq(d.discountPercentage, cash.discountPercentage)) {
    changes.discountPercentage = { from: d.discountPercentage, to: cash.discountPercentage };
    reasons.push('discount% recomputed');
  }
  if (!closeEq(d.priceToZestimateRatio, cash.priceToZestimateRatio)) {
    changes.priceToZestimateRatio = { from: d.priceToZestimateRatio, to: cash.priceToZestimateRatio };
    reasons.push('ratio recomputed');
  }
  if (d.isFixer !== cash.isFixer) {
    changes.isFixer = { from: d.isFixer, to: cash.isFixer };
    reasons.push('isFixer recomputed');
  }
  if ((d.cashDealReason ?? null) !== cash.cashDealReason) {
    changes.cashDealReason = { from: d.cashDealReason ?? null, to: cash.cashDealReason };
    reasons.push('cashDealReason recomputed');
  }

  // 3. dealTypes reconciliation
  const isDistressed = Boolean(d.isAuction || d.isForeclosure || d.isBankOwned);
  const storedDealTypes: string[] = Array.isArray(d.dealTypes) ? d.dealTypes.filter((t: any) =>
    t === 'owner_finance' || t === 'cash_deal'
  ) : [];

  const ofSignals = Boolean(
    d.isOwnerfinance === true ||
    d.ownerFinanceVerified === true ||
    d.agentConfirmedOwnerfinance === true ||
    storedDealTypes.includes('owner_finance')
  );

  const finalOF = ofSignals && !isDistressed;
  const finalCash = cash.isCashDeal;

  const finalDealTypes: string[] = [];
  if (finalOF) finalDealTypes.push('owner_finance');
  if (finalCash) finalDealTypes.push('cash_deal');

  if (!shallowEq(storedDealTypes.slice().sort(), finalDealTypes.slice().sort())) {
    changes.dealTypes = { from: d.dealTypes, to: finalDealTypes };
    reasons.push('dealTypes reconciled');
  }
  if (d.isOwnerfinance !== finalOF) {
    changes.isOwnerfinance = { from: d.isOwnerfinance, to: finalOF };
    reasons.push('isOwnerfinance synced');
  }
  if (d.isCashDeal !== finalCash) {
    changes.isCashDeal = { from: d.isCashDeal, to: finalCash };
    reasons.push('isCashDeal synced');
  }

  return { id, changes, reasons };
}

async function main() {
  console.log('='.repeat(70));
  console.log(`RECONCILE PROPERTIES — ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN'}`);
  if (RESYNC_TYPESENSE) console.log('Typesense re-indexing: ENABLED');
  if (LIMIT > 0) console.log(`Limit: first ${LIMIT} changed docs`);
  console.log('='.repeat(70));

  const snap = await db.collection('properties').get();
  console.log(`Fetched ${snap.size} docs\n`);

  const reasonCounts: Record<string, number> = {};
  const changed: ReconcileResult[] = [];
  let scanned = 0;

  for (const doc of snap.docs) {
    scanned++;
    const d = { id: doc.id, ...doc.data() };
    const r = reconcile(d);
    if (Object.keys(r.changes).length > 0) {
      changed.push(r);
      for (const reason of r.reasons) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }
    if (scanned % 1000 === 0) process.stdout.write(`  scanned ${scanned}... changed ${changed.length}\n`);
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Scanned: ${scanned}`);
  console.log(`Docs with changes: ${changed.length}`);
  console.log('\nChange reasons:');
  for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(32)} ${count}`);
  }

  // Show a few samples
  console.log('\n---- Sample changes (first 5) ----');
  for (const r of changed.slice(0, 5)) {
    console.log(`\n${r.id}  (${r.reasons.join(', ')})`);
    for (const [field, { from, to }] of Object.entries(r.changes)) {
      console.log(`  ${field}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
    }
  }

  if (!APPLY) {
    console.log('\n(DRY RUN — no writes. Re-run with --apply to commit)');
    return;
  }

  // Apply writes in chunks of 400 (under Firestore batch cap 500)
  const toApply = LIMIT > 0 ? changed.slice(0, LIMIT) : changed;
  console.log(`\nWriting ${toApply.length} docs...`);

  const BATCH = 400;
  let written = 0;
  for (let i = 0; i < toApply.length; i += BATCH) {
    const slice = toApply.slice(i, i + BATCH);
    const batch = db.batch();
    for (const r of slice) {
      const ref = db.collection('properties').doc(r.id);
      const update: Record<string, any> = {};
      for (const [field, { to }] of Object.entries(r.changes)) {
        update[field] = to === null ? admin.firestore.FieldValue.delete() : to;
      }
      update.reconciledAt = new Date();
      batch.update(ref, update);
    }
    await batch.commit();
    written += slice.length;
    console.log(`  batch ${Math.floor(i / BATCH) + 1}: wrote ${slice.length} (total ${written}/${toApply.length})`);
  }
  console.log(`\n✅ Wrote ${written} docs`);

  if (RESYNC_TYPESENSE) {
    console.log('\nRe-indexing updated docs to Typesense...');
    let tsOK = 0;
    let tsFail = 0;
    for (let i = 0; i < toApply.length; i += 50) {
      const slice = toApply.slice(i, i + 50);
      const results = await Promise.all(slice.map(async r => {
        const snap = await db.collection('properties').doc(r.id).get();
        if (!snap.exists) return false;
        return indexRawFirestoreProperty(r.id, snap.data()!, 'properties');
      }));
      tsOK += results.filter(Boolean).length;
      tsFail += results.filter(x => !x).length;
      console.log(`  Typesense batch ${Math.floor(i / 50) + 1}: ok=${results.filter(Boolean).length} fail=${results.filter(x => !x).length}`);
    }
    console.log(`\n✅ Typesense: ${tsOK} ok, ${tsFail} failed`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
