/**
 * Diagnose test-buyer patterns. Read-only — no writes.
 *
 *   npx tsx scripts/diagnose-test-buyers.ts
 *
 * Groups and prints buyers by suspicious pattern:
 *   (a) phone duplicates — multiple buyerProfiles share a phone
 *   (b) phone matches a phone we've seen on a recently-deleted test realtor
 *   (c) time-burst creations — >= N buyers created within M minutes
 *   (d) zero-activity stale — created >= 30d ago, no likes/passes, not purchased
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

// Phones the just-deleted test realtors were using (captured before scrub).
// Any buyer sharing one of these is almost certainly also a test record.
const KNOWN_TEST_PHONES = new Set([
  '+16666666666',
  '+15554443333',
  '+11231231234',
  '+18318319661',
  '+15550002222',
]);

const BURST_THRESHOLD = 4;           // 4+ buyers in the window → flag burst
const BURST_WINDOW_MS = 60 * 60_000; // 60-minute window
const STALE_AGE_DAYS = 60;           // no activity this long → flag stale
const NOW = Date.now();

function toMillis(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  const toDate = (v as { toDate?: () => Date }).toDate;
  if (typeof toDate === 'function') {
    try { return toDate.call(v).getTime(); } catch { return null; }
  }
  if (typeof v === 'string') { const d = Date.parse(v); return isNaN(d) ? null : d; }
  if (typeof v === 'number') return v;
  return null;
}

function fmt(ms: number | null): string {
  if (ms == null) return '—';
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

async function main() {
  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const snap = await db.collection('buyerProfiles').get();
  const buyers = snap.docs
    .filter(d => d.data().deleted !== true)
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || '—',
        email: String(data.email || '—'),
        phone: String(data.phone || ''),
        city: String(data.city || data.preferredCity || '—'),
        state: String(data.state || data.preferredState || '—'),
        createdMs: toMillis(data.createdAt),
        likes: Array.isArray(data.likedPropertyIds) ? data.likedPropertyIds.length : 0,
        passes: Array.isArray(data.passedPropertyIds) ? data.passedPropertyIds.length : 0,
        purchased: data.isAvailableForPurchase === false && !!data.purchasedBy,
        revoked: !!data.tcpaRevokedAt,
      };
    });

  console.log(`Total non-deleted buyerProfiles: ${buyers.length}\n`);

  // ─── (a) phone duplicates ──────────────────────────────────────────────
  const byPhone = new Map<string, typeof buyers>();
  for (const b of buyers) {
    if (!b.phone) continue;
    const normalized = b.phone.replace(/\D/g, '').slice(-10);
    if (!normalized) continue;
    if (!byPhone.has(normalized)) byPhone.set(normalized, []);
    byPhone.get(normalized)!.push(b);
  }
  const phoneDupes = [...byPhone.entries()].filter(([, list]) => list.length > 1);

  console.log(`─── (a) PHONE DUPLICATES — ${phoneDupes.length} phones shared by multiple buyers ───`);
  for (const [phone, list] of phoneDupes) {
    console.log(`\n  phone: ${phone}  (${list.length} buyers)`);
    for (const b of list) {
      console.log(`    ${b.id} | ${b.name} | ${b.email} | ${b.city}, ${b.state} | likes:${b.likes} passes:${b.passes} | created ${fmt(b.createdMs)}`);
    }
  }

  // ─── (b) known test-realtor phones ─────────────────────────────────────
  console.log(`\n\n─── (b) BUYERS WITH KNOWN TEST-REALTOR PHONES ───`);
  const testPhoneMatches = buyers.filter(b => KNOWN_TEST_PHONES.has(b.phone));
  if (testPhoneMatches.length === 0) {
    console.log('  (none)');
  } else {
    for (const b of testPhoneMatches) {
      console.log(`  ${b.id} | ${b.name} | ${b.email} | ${b.phone} | ${b.city}, ${b.state} | created ${fmt(b.createdMs)}`);
    }
  }

  // ─── (c) time-burst creations ──────────────────────────────────────────
  console.log(`\n\n─── (c) TIME-BURST CREATIONS — ≥${BURST_THRESHOLD} buyers within ${BURST_WINDOW_MS / 60_000}min ───`);
  const sorted = buyers.filter(b => b.createdMs != null).sort((a, b) => (a.createdMs! - b.createdMs!));
  const bursts: Array<typeof buyers> = [];
  let window: typeof buyers = [];
  for (const b of sorted) {
    if (window.length === 0) { window = [b]; continue; }
    const windowStart = window[0].createdMs!;
    if (b.createdMs! - windowStart <= BURST_WINDOW_MS) {
      window.push(b);
    } else {
      if (window.length >= BURST_THRESHOLD) bursts.push(window);
      // Slide window: drop records older than current-window-size from the left
      while (window.length > 0 && b.createdMs! - window[0].createdMs! > BURST_WINDOW_MS) window.shift();
      window.push(b);
    }
  }
  if (window.length >= BURST_THRESHOLD) bursts.push(window);

  if (bursts.length === 0) {
    console.log('  (none)');
  } else {
    for (const w of bursts) {
      const span = w[w.length - 1].createdMs! - w[0].createdMs!;
      console.log(`\n  Burst: ${w.length} buyers in ${Math.round(span / 60_000)} min — starting ${fmt(w[0].createdMs)}`);
      for (const b of w) {
        console.log(`    ${b.id} | ${b.name} | ${b.email} | ${b.phone} | ${b.city}, ${b.state} | likes:${b.likes} passes:${b.passes}`);
      }
    }
  }

  // ─── (d) zero-activity stale ───────────────────────────────────────────
  console.log(`\n\n─── (d) ZERO-ACTIVITY STALE — created ≥ ${STALE_AGE_DAYS}d ago, no likes/passes, not purchased ───`);
  const stale = buyers.filter(b => {
    if (!b.createdMs) return false;
    const ageDays = (NOW - b.createdMs) / 86_400_000;
    return ageDays >= STALE_AGE_DAYS && b.likes === 0 && b.passes === 0 && !b.purchased;
  });
  console.log(`  count: ${stale.length}`);
  for (const b of stale.slice(0, 50)) {
    console.log(`    ${b.id} | ${b.name} | ${b.email} | ${b.phone} | ${b.city}, ${b.state} | created ${fmt(b.createdMs)}`);
  }
  if (stale.length > 50) console.log(`    ... (${stale.length - 50} more)`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
