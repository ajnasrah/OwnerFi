/**
 * List every buyerProfile in Firestore with enough context to spot test
 * accounts. Read-only.
 *
 *   npx tsx scripts/list-all-buyers.ts              # all non-deleted
 *   npx tsx scripts/list-all-buyers.ts --all        # include deleted too
 *   npx tsx scripts/list-all-buyers.ts --suspect    # only heuristic-suspect rows
 *
 * Columns: id, name, email, phone, city/state, agr(signed), revoked,
 * optOut, created
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

function toDateStr(v: unknown): string {
  if (!v) return '—';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof (v as { toDate?: unknown }).toDate === 'function') {
    try { return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10); } catch { return '—'; }
  }
  if (typeof v === 'string') return v.slice(0, 10);
  return '—';
}

function isSuspect(data: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  const email = String(data.email || '').toLowerCase();
  const phone = String(data.phone || '');
  const firstName = String(data.firstName || '').toLowerCase();
  const lastName = String(data.lastName || '').toLowerCase();
  const TEST_DOMAINS = ['@test.com', '@example.com', '@example.org', '@example.net', '@fake.com', '@mailinator.com', '@tester.com', '@testing.com', '@famsfa.com', '@fkdlafma.com', '@ajnasra.com', '@ajnasrah.com', '@pros.com'];
  for (const d of TEST_DOMAINS) if (email.endsWith(d)) reasons.push(`email:${d}`);
  if (/^(test|qa|demo|staging|dev|temp|throwaway|fake|dummy|e2e)[0-9@._-]/i.test(email)) reasons.push('email-prefix');
  if (['test', 'qa', 'demo', 'fake', 'dummy', 'tester'].includes(firstName)) reasons.push(`first:"${firstName}"`);
  if (['test', 'qa', 'demo', 'fake', 'dummy', 'tester'].includes(lastName)) reasons.push(`last:"${lastName}"`);
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^(\d)\1{9}$/.test(last10)) reasons.push('phone-repeated');
    if (last10 === '1231231234' || last10 === '5555555555' || last10 === '5554443333' || last10 === '5550002222') reasons.push('phone-sequential');
    if (/^5550/.test(last10)) reasons.push('phone-555-0XXX');
  }
  // Keyboard-smash email heuristic: long local-part with > 50% non-vowel consonant run
  const local = email.split('@')[0] || '';
  if (local.length >= 6) {
    const run = local.match(/[bcdfghjklmnpqrstvwxyz]{5,}/i);
    if (run) reasons.push(`email-consonants:"${run[0]}"`);
  }
  return reasons;
}

async function main() {
  const args = process.argv.slice(2);
  const includeDeleted = args.includes('--all');
  const suspectOnly = args.includes('--suspect');

  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const snap = await db.collection('buyerProfiles').get();
  const buyers = snap.docs.filter(d => {
    if (includeDeleted) return true;
    return d.data().deleted !== true;
  });

  // Pre-load agreement counts per buyer
  const agrSnap = await db.collection('referralAgreements').get();
  const agrCount: Record<string, { total: number; signed: number }> = {};
  for (const d of agrSnap.docs) {
    const data = d.data();
    const id = String(data.buyerId || '');
    if (!id) continue;
    if (!agrCount[id]) agrCount[id] = { total: 0, signed: 0 };
    agrCount[id].total++;
    if (data.status === 'signed') agrCount[id].signed++;
  }

  console.log(`Total buyerProfiles (${includeDeleted ? 'incl. deleted' : 'non-deleted'}): ${buyers.length}\n`);
  console.log('id | name | email | phone | city,state | agr(signed) | revoked | optOut | available | created | suspect?');
  console.log('-'.repeat(160));

  buyers.sort((a, b) => {
    const ca = a.data().createdAt?.toMillis?.() || 0;
    const cb = b.data().createdAt?.toMillis?.() || 0;
    return ca - cb;
  });

  let shown = 0;
  let suspects = 0;
  for (const doc of buyers) {
    const d = doc.data();
    const suspectReasons = isSuspect(d);
    if (suspectReasons.length > 0) suspects++;
    if (suspectOnly && suspectReasons.length === 0) continue;

    const name = `${d.firstName || ''} ${d.lastName || ''}`.trim() || '—';
    const email = d.email || '—';
    const phone = d.phone || '—';
    const city = d.city || d.preferredCity || '—';
    const state = d.state || d.preferredState || '—';
    const agr = agrCount[doc.id] || { total: 0, signed: 0 };
    const revoked = d.tcpaRevokedAt ? 'YES' : '';
    const optOut = d.marketingOptOut === true ? 'YES' : '';
    const available = d.isAvailableForPurchase === false ? '' : '✓';
    const created = toDateStr(d.createdAt);
    const suspect = suspectReasons.length > 0 ? `⚠ ${suspectReasons.join(',')}` : '';

    console.log(
      `${doc.id} | ${name} | ${email} | ${phone} | ${city}, ${state} | ${agr.total}(${agr.signed}) | ${revoked} | ${optOut} | ${available} | ${created} | ${suspect}`,
    );
    shown++;
  }

  console.log(`\nShown: ${shown}. Heuristic-suspect: ${suspects}.`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
