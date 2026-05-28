/**
 * Backfill `users/{uid}.phoneNumberVerified = true` for legacy phone-OTP
 * signups whose docs predate the field.
 *
 * Why this exists: mobile reads `phoneNumberVerified` to gate the
 * verify-phone enforcement badge. The field landed on 2026-05-27 (mobile
 * PR #46 + web PR #37). Users created before that date never had the
 * field written — phone-OTP signups would otherwise see the badge and
 * be asked to re-verify a phone they already OTP'd at signup.
 *
 * Heuristic for "this user was phone-OTP-verified at create time":
 *
 *   - `phone` is a non-empty string  AND
 *   - (
 *       `password === ''`              // pure phone signup (signup-phone
 *                                       // route stores an empty string —
 *                                       // see route.ts:240)
 *       OR
 *       `migratedToPhoneAuth === true` // existing email account that
 *                                       // linked a phone via signup-phone
 *                                       // (route.ts:224)
 *     )
 *
 * Anyone outside this set (e.g. email/password signups who typed a phone
 * but never OTP'd it) is intentionally left untouched — they're the
 * target audience for the verify-phone enforcement flow.
 *
 * Idempotent: skips users whose `phoneNumberVerified` is already true.
 *
 * DRY-RUN by default. Pass `--confirm` to actually write.
 *
 *   tsx scripts/backfill-phone-number-verified.ts             # dry run
 *   tsx scripts/backfill-phone-number-verified.ts --confirm   # writes
 */

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getFirebaseAdmin, FieldValue } from '../src/lib/scraper-v2/firebase-admin';

const CONFIRM = process.argv.includes('--confirm');

// Firestore batch limit is 500 ops; stay well under so concurrent
// system writes never push us into the failure mode.
const BATCH_SIZE = 400;

type UserDoc = {
  id: string;
  phone?: unknown;
  password?: unknown;
  migratedToPhoneAuth?: unknown;
  phoneNumberVerified?: unknown;
};

type Decision =
  | { kind: 'skip-no-phone' }
  | { kind: 'skip-already-verified' }
  | { kind: 'skip-not-phone-otp' }
  | { kind: 'update' };

function decide(u: UserDoc): Decision {
  if (typeof u.phone !== 'string' || u.phone.trim().length === 0) {
    return { kind: 'skip-no-phone' };
  }
  if (u.phoneNumberVerified === true) {
    return { kind: 'skip-already-verified' };
  }
  const isPureOtp = u.password === '';
  const isMigrated = u.migratedToPhoneAuth === true;
  if (!isPureOtp && !isMigrated) {
    return { kind: 'skip-not-phone-otp' };
  }
  return { kind: 'update' };
}

async function main() {
  const { db } = getFirebaseAdmin();
  console.log(
    `Backfill phoneNumberVerified — mode: ${CONFIRM ? 'LIVE WRITE' : 'DRY RUN'}\n`
  );

  const snap = await db.collection('users').get();
  console.log(`Scanned ${snap.size} user docs.\n`);

  const counts = {
    skipNoPhone: 0,
    skipAlreadyVerified: 0,
    skipNotPhoneOtp: 0,
    update: 0,
  };
  const updates: Array<{ id: string; phone: string }> = [];

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const u: UserDoc = {
      id: doc.id,
      phone: data.phone,
      password: data.password,
      migratedToPhoneAuth: data.migratedToPhoneAuth,
      phoneNumberVerified: data.phoneNumberVerified,
    };
    const d = decide(u);
    switch (d.kind) {
      case 'skip-no-phone':
        counts.skipNoPhone++;
        break;
      case 'skip-already-verified':
        counts.skipAlreadyVerified++;
        break;
      case 'skip-not-phone-otp':
        counts.skipNotPhoneOtp++;
        break;
      case 'update':
        counts.update++;
        updates.push({ id: doc.id, phone: u.phone as string });
        break;
    }
  }

  console.log('Decision counts:');
  console.log(`  ↳ skip (no phone):           ${counts.skipNoPhone}`);
  console.log(`  ↳ skip (already verified):   ${counts.skipAlreadyVerified}`);
  console.log(`  ↳ skip (not phone-OTP):      ${counts.skipNotPhoneOtp}`);
  console.log(`  ↳ update (set verified=true): ${counts.update}`);
  console.log('');

  if (counts.update === 0) {
    console.log('Nothing to update. Exiting.');
    return;
  }

  if (!CONFIRM) {
    // Show a small sample so the operator can eyeball the candidates
    // before re-running with --confirm.
    const sample = updates.slice(0, 10);
    console.log(`Sample of users that WOULD be updated (max 10):`);
    for (const u of sample) {
      console.log(`  ${u.id}  phone=${maskPhone(u.phone)}`);
    }
    if (updates.length > sample.length) {
      console.log(`  ... ${updates.length - sample.length} more`);
    }
    console.log('\nRe-run with --confirm to write.');
    return;
  }

  console.log(`Writing ${updates.length} updates in batches of ${BATCH_SIZE}...`);
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const u of slice) {
      batch.update(db.collection('users').doc(u.id), {
        phoneNumberVerified: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += slice.length;
    console.log(`  ↳ ${written} / ${updates.length}`);
  }
  console.log(`\n✅ Done. Updated ${written} users.`);
}

// Mask the middle digits of an E.164 phone for log redaction — same
// shape `src/lib/log-redact.ts:maskPhone` uses on the request path.
function maskPhone(p: string): string {
  if (p.length < 6) return '***';
  return `${p.slice(0, 5)}***${p.slice(-2)}`;
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
