/**
 * List every realtor in Firestore with engagement signals so an operator
 * can spot test accounts the heuristic flag missed. Read-only.
 *
 *   npx tsx scripts/list-all-realtors.ts
 *
 * Output columns:
 *   id, name, email, phone, brokerage, license#, agreements, purchases,
 *   signedCount, createdAt, lastLogin (if present)
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

async function main() {
  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const usersSnap = await db.collection('users').where('role', '==', 'realtor').get();
  const realtors = usersSnap.docs.filter(d => d.data().deleted !== true);

  // Pre-load agreements + leadPurchases counts per realtor in one pass
  const [agrSnap, purSnap] = await Promise.all([
    db.collection('referralAgreements').get(),
    db.collection('leadPurchases').get(),
  ]);
  const agrCount: Record<string, { total: number; signed: number }> = {};
  for (const d of agrSnap.docs) {
    const data = d.data();
    const id = String(data.realtorUserId || '');
    if (!id) continue;
    if (!agrCount[id]) agrCount[id] = { total: 0, signed: 0 };
    agrCount[id].total++;
    if (data.status === 'signed') agrCount[id].signed++;
  }
  const purCount: Record<string, number> = {};
  for (const d of purSnap.docs) {
    const data = d.data();
    const id = String(data.realtorUserId || '');
    if (!id) continue;
    purCount[id] = (purCount[id] || 0) + 1;
  }

  console.log(`Total non-deleted realtors: ${realtors.length}\n`);
  console.log('id | name | email | phone | brokerage | license | agrs(signed) | purchases | created | lastLogin');
  console.log('-'.repeat(140));

  // Sort by createdAt ascending so oldest first (easy to scan test pattern)
  realtors.sort((a, b) => {
    const ca = a.data().createdAt?.toMillis?.() || 0;
    const cb = b.data().createdAt?.toMillis?.() || 0;
    return ca - cb;
  });

  for (const doc of realtors) {
    const d = doc.data();
    const rd = d.realtorData || {};
    const name = d.name || `${rd.firstName || ''} ${rd.lastName || ''}`.trim() || '—';
    const email = d.email || rd.email || '—';
    const phone = d.phone || rd.phone || '—';
    const brokerage = rd.company || '—';
    const license = rd.licenseNumber || '—';
    const agr = agrCount[doc.id] || { total: 0, signed: 0 };
    const pur = purCount[doc.id] || 0;
    const created = toDateStr(d.createdAt);
    const lastLogin = toDateStr(d.lastLoginAt);

    console.log(
      `${doc.id} | ${name} | ${email} | ${phone} | ${brokerage} | ${license} | ${agr.total}(${agr.signed}) | ${pur} | ${created} | ${lastLogin}`,
    );
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
