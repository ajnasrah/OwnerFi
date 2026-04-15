/**
 * One-off migration: annotate tcpa_consents rows captured under
 * CONSENT_TEXT_VERSION = '2026-04-14-v1' with the fact that the stored
 * `consentTextFull` did NOT match what the UI actually rendered.
 *
 * Background: between commits bd5e12a1 (v1 introduced) and the v2 bump on
 * 2026-04-14, `PHONE_CONSENT_TEXT_AUTH` omitted the trailing sentence
 * "See our Privacy Notice at Collection and Terms." even though the JSX at
 * src/app/auth/page.tsx had been rendering that sentence since commit
 * ecbe35be (legal audit). Each v1 row therefore stores a `consentTextHash`
 * that hashes the wrong text — in court, producing a hash that does not
 * match the rendered DOM is worse than producing no hash at all.
 *
 * What this does:
 *   1. Loads every doc in tcpa_consents where consentTextVersion === '2026-04-14-v1'.
 *   2. Adds annotation fields. Original `consentTextFull` and `consentTextHash`
 *      are LEFT UNTOUCHED for chain-of-custody (we never mutate evidence —
 *      we only annotate it).
 *
 * Annotation fields written:
 *   - hashDriftKnown: true
 *   - hashDriftReason: human-readable explanation
 *   - actualUiTextAtTime: literal v2 text (what was on screen)
 *   - actualUiTextHashAtTime: sha256 of actualUiTextAtTime
 *   - driftMigratedAt: timestamp of this run
 *   - driftMigrationCommit: pinned for traceability
 *
 * Usage:
 *   npx tsx scripts/migrate-v1-consent-hash-drift.ts --dry-run
 *   npx tsx scripts/migrate-v1-consent-hash-drift.ts --confirm
 */

import { createHash } from 'crypto';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

// The actual v2 text (what /auth/page.tsx renders). Kept inline so this
// migration's behavior is frozen even if the constant in tcpa-consent.ts
// is bumped again later.
const ACTUAL_UI_TEXT_V2 = `By entering your phone number and tapping Send Verification Code, you give express written consent to receive calls and SMS messages from Ownerfi and from licensed real estate agents we share your information with, including calls/SMS that use auto-dialing systems or pre-recorded messages, at the number you provided, even if it is on a federal or state Do-Not-Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out of SMS at any time. See our Privacy Notice at Collection and Terms.`;

const V1_VERSION = '2026-04-14-v1';

const HASH_DRIFT_REASON =
  `consentTextFull captured under v1 omitted the trailing sentence ` +
  `"See our Privacy Notice at Collection and Terms." which the /auth UI ` +
  `had been rendering since commit ecbe35be. Original consentTextFull and ` +
  `consentTextHash are preserved unchanged; this row was annotated post-hoc.`;

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const confirmed = args.has('--confirm');

  if (!dryRun && !confirmed) {
    console.error('Refusing to run without --dry-run or --confirm');
    process.exit(1);
  }

  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const actualHash = createHash('sha256').update(ACTUAL_UI_TEXT_V2, 'utf8').digest('hex');
  const migratedAt = new Date();
  const driftMigrationCommit = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

  console.log(`Querying tcpa_consents WHERE consentTextVersion == '${V1_VERSION}'...`);
  const snap = await db
    .collection('tcpa_consents')
    .where('consentTextVersion', '==', V1_VERSION)
    .get();

  console.log(`Found ${snap.size} v1 consent rows.`);
  if (snap.empty) {
    console.log('Nothing to do.');
    return;
  }

  let toUpdate = 0;
  let alreadyAnnotated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.hashDriftKnown === true) {
      alreadyAnnotated++;
    } else {
      toUpdate++;
    }
  }

  console.log(`  ${toUpdate} need annotation`);
  console.log(`  ${alreadyAnnotated} already annotated (skipping)`);

  if (dryRun) {
    console.log('--dry-run: no writes performed.');
    return;
  }

  // Batched commits, 400 per batch (Firestore limit 500).
  const BATCH_SIZE = 400;
  let written = 0;
  let batch = db.batch();
  let inBatch = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.hashDriftKnown === true) continue;
    batch.update(doc.ref, {
      hashDriftKnown: true,
      hashDriftReason: HASH_DRIFT_REASON,
      actualUiTextAtTime: ACTUAL_UI_TEXT_V2,
      actualUiTextHashAtTime: actualHash,
      driftMigratedAt: migratedAt,
      driftMigrationCommit,
    });
    inBatch++;
    written++;
    if (inBatch >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  committed ${written}/${toUpdate}`);
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) {
    await batch.commit();
    console.log(`  committed ${written}/${toUpdate}`);
  }

  console.log(`Done. Annotated ${written} v1 consent rows.`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
