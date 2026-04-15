/**
 * Cleanup test user/agent/buyer records from production Firestore.
 *
 * Surfaces likely-test records so an operator can review before deletion.
 * Heuristics (any match = flagged as test):
 *   - email ends in @test.com, @example.com, @fake.com, @tester.*
 *   - email or name matches /^(test|qa|demo|staging|dev|admin.?test)/i
 *   - name is literally "Test", "QA", "Demo", "Fake", "Dummy"
 *   - phone is a reserved/fake prefix: +15555550*, +10000000000, +19999999999
 *   - phone matches 10 identical digits (e.g. 1234567890, 5555555555)
 *   - email or phone matches an explicit allow-list of known internal
 *     addresses (can be edited at the top of the script)
 *
 * This script SCANS `users`, `buyerProfiles`, and `referralAgreements` and
 * prints a grouped report. It does NOT delete anything unless invoked with
 * --confirm. With --confirm it performs a soft-delete identical to
 * /api/account/delete (scrub PII, flag deleted:true) and marks linked
 * referralAgreements voided. Phone-based TCPA revocation is skipped here
 * because test accounts were never real consumers and we don't want to
 * pollute the tcpa_revocations audit collection.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-users.ts --dry-run
 *   npx tsx scripts/cleanup-test-users.ts --confirm
 *
 * Optional flags:
 *   --only=users|buyers|realtors|agreements    scope one collection
 *   --email-contains=<substr>                  extra filter
 *   --include-admins                           also flag role=admin (off by default)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

// ─── Heuristics ──────────────────────────────────────────────────────────────

const TEST_EMAIL_DOMAINS = [
  '@test.com',
  '@example.com',
  '@example.org',
  '@example.net',
  '@fake.com',
  '@mailinator.com',
  '@tester.com',
  '@testing.com',
];

const TEST_EMAIL_PREFIXES = /^(test|qa|demo|staging|dev|temp|throwaway|fake|dummy|admin[._-]?test|e2e)[0-9@._-]/i;

const TEST_NAME_LITERALS = new Set(['test', 'qa', 'demo', 'fake', 'dummy', 'tester']);

/** Known-fake phone prefixes. Reserved 555-01XX and 10/9-all-same. */
const TEST_PHONE_REGEX = /^(\+?1?5555501\d{2}|\+?10{10}|\+?19{10}|\+?1?5{10}|\+?1?0{10}|\+?1?1234567890|\+?1?5555555555)$/;

/** Operator-editable allow-list. Add known-internal addresses here. */
const ADDITIONAL_TEST_EMAILS = new Set<string>([
  // 'abdullah+test@prosway.com',
]);

const ADDITIONAL_TEST_PHONES = new Set<string>([
  // '+15551234567',
]);

// ─── Flag helpers ────────────────────────────────────────────────────────────

function normalize(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function flagsFor(data: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  const email = normalize(data.email);
  const phone = normalize(data.phone);
  const firstName = normalize(data.firstName);
  const lastName = normalize(data.lastName);
  const fullName = normalize(data.name) || `${firstName} ${lastName}`.trim();

  if (ADDITIONAL_TEST_EMAILS.has(email)) reasons.push('allow-list:email');
  if (ADDITIONAL_TEST_PHONES.has(phone)) reasons.push('allow-list:phone');

  for (const domain of TEST_EMAIL_DOMAINS) {
    if (email.endsWith(domain)) reasons.push(`email-domain:${domain}`);
  }
  if (TEST_EMAIL_PREFIXES.test(email)) reasons.push('email-prefix');
  if (TEST_EMAIL_PREFIXES.test(fullName)) reasons.push('name-prefix');
  if (TEST_NAME_LITERALS.has(firstName)) reasons.push(`first-name:"${firstName}"`);
  if (TEST_NAME_LITERALS.has(lastName)) reasons.push(`last-name:"${lastName}"`);
  if (TEST_NAME_LITERALS.has(fullName)) reasons.push(`name:"${fullName}"`);

  if (phone && TEST_PHONE_REGEX.test(phone.replace(/[^\d+]/g, ''))) reasons.push('phone-fake');
  // Phone with 10 identical digits (e.g. 5555555555)
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10 && /^(\d)\1{9}$/.test(digits.slice(-10))) reasons.push('phone-repeated');

  return reasons;
}

interface Candidate {
  collection: string;
  id: string;
  email: string;
  phone: string;
  name: string;
  role?: string;
  reasons: string[];
  // Links for context
  userId?: string;
  realtorUserId?: string;
  buyerId?: string;
  agreementNumber?: string;
  status?: string;
}

async function scan(options: {
  only?: string;
  emailContains?: string;
  includeAdmins: boolean;
}) {
  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const results: Record<string, Candidate[]> = {
    users: [],
    buyerProfiles: [],
    referralAgreements: [],
  };

  const scopeMatches = (name: string) => !options.only || options.only === name;

  // USERS (combined buyer + realtor)
  if (scopeMatches('users')) {
    const snap = await db.collection('users').get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.deleted === true) continue; // already cleaned up
      const role = String(data.role || '');
      if (role === 'admin' && !options.includeAdmins) continue;
      const extra: string[] = [];
      if (options.emailContains && normalize(data.email).includes(options.emailContains.toLowerCase())) {
        extra.push(`email-contains:${options.emailContains}`);
      }
      const reasons = [...flagsFor(data), ...extra];
      if (reasons.length === 0) continue;
      results.users.push({
        collection: 'users',
        id: doc.id,
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        name: String(data.name || [data.firstName, data.lastName].filter(Boolean).join(' ') || ''),
        role,
        reasons,
      });
    }
  }

  // BUYER PROFILES
  if (scopeMatches('buyers')) {
    const snap = await db.collection('buyerProfiles').get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.deleted === true) continue;
      const extra: string[] = [];
      if (options.emailContains && normalize(data.email).includes(options.emailContains.toLowerCase())) {
        extra.push(`email-contains:${options.emailContains}`);
      }
      const reasons = [...flagsFor(data), ...extra];
      if (reasons.length === 0) continue;
      results.buyerProfiles.push({
        collection: 'buyerProfiles',
        id: doc.id,
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        reasons,
        userId: String(data.userId || ''),
      });
    }
  }

  // REFERRAL AGREEMENTS (flag those pointing at flagged users/buyers)
  if (scopeMatches('agreements')) {
    const flaggedUserIds = new Set(results.users.map(u => u.id));
    const flaggedBuyerIds = new Set(results.buyerProfiles.map(b => b.id));
    if (flaggedUserIds.size > 0 || flaggedBuyerIds.size > 0) {
      const snap = await db.collection('referralAgreements').get();
      for (const doc of snap.docs) {
        const data = doc.data();
        const realtorUserId = String(data.realtorUserId || '');
        const buyerId = String(data.buyerId || '');
        const reasons: string[] = [];
        if (flaggedUserIds.has(realtorUserId)) reasons.push('realtor-is-test');
        if (flaggedBuyerIds.has(buyerId)) reasons.push('buyer-is-test');
        if (reasons.length === 0) continue;
        results.referralAgreements.push({
          collection: 'referralAgreements',
          id: doc.id,
          email: String(data.realtorEmail || data.buyerEmail || ''),
          phone: String(data.realtorPhone || data.buyerPhone || ''),
          name: String(data.realtorName || [data.buyerFirstName, data.buyerLastName].filter(Boolean).join(' ') || ''),
          reasons,
          realtorUserId,
          buyerId,
          agreementNumber: String(data.agreementNumber || ''),
          status: String(data.status || ''),
        });
      }
    }
  }

  return results;
}

function printReport(results: Record<string, Candidate[]>) {
  for (const [collection, items] of Object.entries(results)) {
    console.log(`\n─── ${collection} (${items.length}) ───`);
    if (items.length === 0) {
      console.log('  (no matches)');
      continue;
    }
    for (const c of items) {
      const lines = [
        `  ${c.id}`,
        `    name:   ${c.name || '—'}`,
        `    email:  ${c.email || '—'}`,
        `    phone:  ${c.phone || '—'}`,
      ];
      if (c.role) lines.push(`    role:   ${c.role}`);
      if (c.userId) lines.push(`    user:   ${c.userId}`);
      if (c.realtorUserId) lines.push(`    realtor:${c.realtorUserId}`);
      if (c.buyerId) lines.push(`    buyer:  ${c.buyerId}`);
      if (c.agreementNumber) lines.push(`    agreement: #${c.agreementNumber} (${c.status})`);
      lines.push(`    reasons: ${c.reasons.join(', ')}`);
      console.log(lines.join('\n'));
    }
  }
}

async function performDelete(results: Record<string, Candidate[]>) {
  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const deletedAt = new Date();
  let userScrubs = 0;
  let buyerScrubs = 0;
  let agreementsVoided = 0;

  // Scrub users
  for (const u of results.users) {
    await db.collection('users').doc(u.id).set(
      {
        deletedAt,
        deleted: true,
        email: null,
        phone: null,
        name: null,
        role: 'deleted',
        deletedReason: 'test-data-cleanup: ' + u.reasons.join(','),
      },
      { merge: true },
    );
    userScrubs++;
  }

  // Scrub buyer profiles
  for (const b of results.buyerProfiles) {
    await db.collection('buyerProfiles').doc(b.id).set(
      {
        deletedAt,
        deleted: true,
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        isAvailableForPurchase: false,
        isActive: false,
        smsNotifications: false,
        marketingOptOut: true,
        deletedReason: 'test-data-cleanup: ' + b.reasons.join(','),
      },
      { merge: true },
    );
    buyerScrubs++;
  }

  // Void linked referral agreements so no realtor can act on test leads
  for (const a of results.referralAgreements) {
    await db.collection('referralAgreements').doc(a.id).set(
      {
        status: 'voided',
        voidedAt: deletedAt,
        voidReason: 'test-data-cleanup: ' + a.reasons.join(','),
        updatedAt: deletedAt,
      },
      { merge: true },
    );
    agreementsVoided++;
  }

  return { userScrubs, buyerScrubs, agreementsVoided };
}

// ─── Entry ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirmed = args.includes('--confirm');
  const includeAdmins = args.includes('--include-admins');
  const only = args.find(a => a.startsWith('--only='))?.split('=')[1];
  const emailContains = args.find(a => a.startsWith('--email-contains='))?.split('=')[1];

  if (!dryRun && !confirmed) {
    console.error('Refusing to run: pass --dry-run to preview or --confirm to actually scrub.');
    console.error('--confirm will soft-delete flagged users, scrub buyerProfile PII, void linked agreements.');
    process.exit(1);
  }

  console.log('Scanning Firestore for likely-test records…');
  if (only) console.log(`  scope: ${only}`);
  if (emailContains) console.log(`  email contains: ${emailContains}`);
  if (includeAdmins) console.log('  including role=admin in scan');

  const results = await scan({ only, emailContains, includeAdmins });
  printReport(results);

  const total =
    results.users.length + results.buyerProfiles.length + results.referralAgreements.length;

  console.log(`\nTotal flagged: ${total}`);

  if (dryRun) {
    console.log('\n--dry-run: no writes performed. Review the list above, then re-run with --confirm.');
    return;
  }

  if (total === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  console.log('\n--confirm: performing soft-deletes…');
  const stats = await performDelete(results);
  console.log(`\nDone. Scrubbed ${stats.userScrubs} users, ${stats.buyerScrubs} buyer profiles, voided ${stats.agreementsVoided} agreements.`);
  console.log('Audit trail (tcpa_consents, tcpa_revocations) preserved. Stripe/GHL side not touched — handle separately if needed.');
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
