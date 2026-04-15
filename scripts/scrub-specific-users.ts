/**
 * Targeted user scrub — takes an explicit list of user IDs and soft-deletes
 * each one along with any linked buyerProfiles (via userId) and
 * referralAgreements (where realtorUserId matches OR buyerId matches a
 * linked buyerProfile).
 *
 * Usage:
 *   npx tsx scripts/scrub-specific-users.ts --dry-run
 *   npx tsx scripts/scrub-specific-users.ts --confirm
 *
 * The ID list is hardcoded below — edit USER_IDS + BUYER_PROFILE_IDS to
 * match the records you confirmed for deletion. This is deliberate: unlike
 * the heuristic script, we do NOT want a command-line arg here because a
 * typo in a production ID list would be catastrophic.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

// ─── TARGETS (operator-reviewed) ─────────────────────────────────────────────
//
// 5 realtor test accounts confirmed for scrubbing after visual review:
//   abdullah@pros.com / +16666666666                     (FIb7pDM6aGZ5AqVCdT0i)
//   abduasdkj!a@fkdlafma.com / +15554443333 / tn12345    (5JozoqQhOcCuS5rvgDBS)
//   test test / abdusklj@famsfa.com / +11231231234       (TFIbP9gBXllKzgKuIgRl)
//   abdullah@ajnasra.com / +18318319661 / tx199912       (SxJzsVBTNex6czrZSXG1)
//   aj nasrah / ajnasrah@ajnasrah.com / +15550002222     (RYYKkoMilRfNf0qFCURp)
//
// Explicitly NOT scrubbing:
//   nHTr1RfVWiNOTYRet2MA  (nataly abuhalimeh — operator confirmed real)

const USER_IDS: string[] = [
  // Already scrubbed in the first run — listed here for audit continuity.
  // The script skips already-deleted users so re-running is a no-op on these.
  'FIb7pDM6aGZ5AqVCdT0i',
  '5JozoqQhOcCuS5rvgDBS',
  'TFIbP9gBXllKzgKuIgRl',
  'SxJzsVBTNex6czrZSXG1',
  'RYYKkoMilRfNf0qFCURp',
  // Round 2 — buyer users flagged after diagnostic scan:
  'Gb8m7Bj5PstQ4ougsOc6',   // Ghena Abunasrah (family test)
  'ccYVz9Obxcksy9kDSRVr',   // Jana Abunasrah (family test)
];

// Standalone buyerProfile IDs (not linked to any user in USER_IDS above)
// that should also be scrubbed.
const BUYER_PROFILE_IDS: string[] = [
  'buyer_1766119989144_s5te8b6ce', // "test test" — abdusklj@famsfa.com (round 1)
  // Round 2 — obvious test buyer profiles:
  'buyer_1765643662123_j38jwevyl', // ABDULLAH ABUNASRAH / abdullah@abdullah.abdullah / +19998887777
  'buyer_1765947896696_8gvitfdrj', // abdulla / ajsfnafjk.coim / +18889998888
  'buyer_1770751854561_nya7a2eo6', // abdullah / +19898999898
];

// ─── Script ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirmed = args.includes('--confirm');

  if (!dryRun && !confirmed) {
    console.error('Refusing to run: pass --dry-run to preview or --confirm to actually scrub.');
    process.exit(1);
  }

  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  console.log(`Targets: ${USER_IDS.length} users, ${BUYER_PROFILE_IDS.length} standalone buyer profiles\n`);

  // Phase 1 — collect context for each target
  const plan: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    buyerProfileIds: string[];
    agreementIds: string[];
  }> = [];

  for (const userId of USER_IDS) {
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      console.log(`  [skip] user ${userId} does not exist`);
      continue;
    }
    const userData = userSnap.data() as Record<string, unknown>;
    if (userData.deleted === true) {
      console.log(`  [skip] user ${userId} already soft-deleted`);
      continue;
    }

    // Find linked buyerProfiles by userId
    const bpSnap = await db.collection('buyerProfiles').where('userId', '==', userId).get();
    const buyerProfileIds = bpSnap.docs.map(d => d.id);

    // Find agreements where this user is the realtor
    const agrSnap = await db.collection('referralAgreements').where('realtorUserId', '==', userId).get();
    const agreementIds = agrSnap.docs.map(d => d.id);

    plan.push({
      userId,
      userName: String(userData.name || [userData.firstName, userData.lastName].filter(Boolean).join(' ') || '—'),
      userEmail: String(userData.email || '—'),
      buyerProfileIds,
      agreementIds,
    });
  }

  // Also include standalone buyerProfiles
  const standaloneBuyers: Array<{ id: string; email: string; name: string; linkedAgreementIds: string[] }> = [];
  for (const bpId of BUYER_PROFILE_IDS) {
    const bpSnap = await db.collection('buyerProfiles').doc(bpId).get();
    if (!bpSnap.exists) {
      console.log(`  [skip] buyerProfile ${bpId} does not exist`);
      continue;
    }
    const bp = bpSnap.data() as Record<string, unknown>;
    if (bp.deleted === true) {
      console.log(`  [skip] buyerProfile ${bpId} already soft-deleted`);
      continue;
    }
    // Any agreements referencing this buyer
    const agrSnap = await db.collection('referralAgreements').where('buyerId', '==', bpId).get();
    standaloneBuyers.push({
      id: bpId,
      email: String(bp.email || '—'),
      name: `${bp.firstName || ''} ${bp.lastName || ''}`.trim() || '—',
      linkedAgreementIds: agrSnap.docs.map(d => d.id),
    });
  }

  // Print plan
  console.log('PLAN:');
  for (const p of plan) {
    console.log(`  USER ${p.userId}`);
    console.log(`    name:    ${p.userName}`);
    console.log(`    email:   ${p.userEmail}`);
    console.log(`    buyer profiles: ${p.buyerProfileIds.length} (${p.buyerProfileIds.join(', ') || 'none'})`);
    console.log(`    agreements:     ${p.agreementIds.length} (will void)`);
  }
  for (const b of standaloneBuyers) {
    console.log(`  BUYER_PROFILE ${b.id}`);
    console.log(`    name:  ${b.name}`);
    console.log(`    email: ${b.email}`);
    console.log(`    linked agreements: ${b.linkedAgreementIds.length} (will void)`);
  }

  if (dryRun) {
    console.log('\n--dry-run: no writes performed.');
    return;
  }

  // Phase 2 — execute
  const now = new Date();
  let usersScrubbed = 0;
  let buyersScrubbed = 0;
  let agreementsVoided = 0;

  for (const p of plan) {
    // Scrub user
    await db.collection('users').doc(p.userId).set(
      {
        deletedAt: now,
        deleted: true,
        email: null,
        phone: null,
        name: null,
        role: 'deleted',
        deletedReason: 'targeted-scrub: confirmed test account',
      },
      { merge: true },
    );
    usersScrubbed++;

    // Scrub linked buyer profiles
    for (const bpId of p.buyerProfileIds) {
      await db.collection('buyerProfiles').doc(bpId).set(
        {
          deletedAt: now,
          deleted: true,
          firstName: null,
          lastName: null,
          email: null,
          phone: null,
          isAvailableForPurchase: false,
          isActive: false,
          smsNotifications: false,
          marketingOptOut: true,
          deletedReason: `targeted-scrub: linked to deleted user ${p.userId}`,
        },
        { merge: true },
      );
      buyersScrubbed++;
    }

    // Void linked agreements
    for (const agrId of p.agreementIds) {
      const agrDoc = await db.collection('referralAgreements').doc(agrId).get();
      const agrData = agrDoc.data() as Record<string, unknown> | undefined;
      const priorStatus = String(agrData?.status || '');
      if (priorStatus === 'voided' || priorStatus === 'expired') continue;
      await db.collection('referralAgreements').doc(agrId).set(
        {
          status: 'voided',
          voidedAt: now,
          voidReason: `targeted-scrub: realtor account deleted as test (${p.userId})`,
          priorStatus,
          updatedAt: now,
        },
        { merge: true },
      );
      agreementsVoided++;

      // Release any buyer tied to this agreement back to the pool — ONLY
      // if the buyer is not also being scrubbed (deleted/revoked buyers
      // should stay gated).
      const buyerId = String(agrData?.buyerId || '');
      if (buyerId && !p.buyerProfileIds.includes(buyerId)) {
        const buyerDoc = await db.collection('buyerProfiles').doc(buyerId).get();
        const buyerData = buyerDoc.data() as Record<string, unknown> | undefined;
        if (buyerData && buyerData.deleted !== true && !buyerData.tcpaRevokedAt) {
          await db.collection('buyerProfiles').doc(buyerId).set(
            {
              isAvailableForPurchase: true,
              purchasedBy: null,
              purchasedAt: null,
              reservedBy: null,
              reservedAt: null,
              reservedAgreementId: null,
              updatedAt: now,
              releaseReason: `test-realtor-scrub: previous realtor ${p.userId} deleted as test account`,
            },
            { merge: true },
          );
        }
      }
    }
  }

  for (const b of standaloneBuyers) {
    await db.collection('buyerProfiles').doc(b.id).set(
      {
        deletedAt: now,
        deleted: true,
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        isAvailableForPurchase: false,
        isActive: false,
        smsNotifications: false,
        marketingOptOut: true,
        deletedReason: 'targeted-scrub: confirmed test buyer profile',
      },
      { merge: true },
    );
    buyersScrubbed++;
    for (const agrId of b.linkedAgreementIds) {
      const agrDoc = await db.collection('referralAgreements').doc(agrId).get();
      const agrData = agrDoc.data() as Record<string, unknown> | undefined;
      const priorStatus = String(agrData?.status || '');
      if (priorStatus === 'voided' || priorStatus === 'expired') continue;
      await db.collection('referralAgreements').doc(agrId).set(
        {
          status: 'voided',
          voidedAt: now,
          voidReason: `targeted-scrub: buyer profile ${b.id} deleted as test`,
          priorStatus,
          updatedAt: now,
        },
        { merge: true },
      );
      agreementsVoided++;
    }
  }

  console.log(`\nDone. Scrubbed ${usersScrubbed} users, ${buyersScrubbed} buyer profiles, voided ${agreementsVoided} agreements.`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
