/**
 * Diagnose Typesense sync gap.
 *
 * Compares Firestore's "should be indexed" set (active + OF/Cash) against
 * what's actually in Typesense. For every missing property, categorizes
 * WHY it didn't sync:
 *   - garbage_price: price < $10,000 (CF filter at functions/src/index.ts:159)
 *   - missing_address: no address/city/state (sync script filter at line 200)
 *   - sold_or_inactive: homeStatus in {SOLD, RECENTLY_SOLD, FOR_RENT} but isActive=true (data corruption)
 *   - dealtype_mismatch: dealTypes array says OF/Cash but CF boolean/string fields disagree
 *   - unknown: passes all filters — silent CF failure or never fired
 *
 * Writes a report to scripts/_typesense-gap-report.json.
 *
 * Usage: npx tsx scripts/diagnose-typesense-gap.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const ts = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 30,
});

type MissingRecord = {
  id: string;
  address: string;
  state: string;
  price: number;
  homeStatus: string;
  dealTypesArray: string[] | null;
  dealTypeString: string | null;
  isOwnerfinance: boolean | null;
  isCashDeal: boolean | null;
  createdAt: string | null;
  source: string | null;
  bucket: string;
};

const PERMANENT_STATUSES = new Set(['SOLD', 'RECENTLY_SOLD', 'FOR_RENT']);

async function loadTypesenseIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  const PAGE_SIZE = 250;
  while (true) {
    const res = await ts.collections('properties').documents().search({
      q: '*',
      query_by: 'address',
      per_page: PAGE_SIZE,
      page,
      include_fields: 'id',
    });
    const hits = res.hits || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hits.forEach((h: any) => ids.add(h.document.id));
    if (hits.length < PAGE_SIZE) break;
    page++;
    if (page > 50) break;
  }
  return ids;
}

function bucketFor(data: Record<string, unknown>): string {
  const price = Number(data.listPrice || data.price || 0);
  const address = String(data.fullAddress || data.address || data.streetAddress || '').trim();
  const city = String(data.city || '').trim();
  const state = String(data.state || '').trim();
  const status = String(data.homeStatus || '').toUpperCase();

  if (price < 10000) return 'garbage_price';
  if (!address || !city || !state) return 'missing_address';
  if (PERMANENT_STATUSES.has(status)) return 'sold_status_but_active_flag';

  const dealTypesArray = Array.isArray(data.dealTypes) ? (data.dealTypes as string[]) : [];
  const dealTypeString = String(data.dealType || '');
  const isOwnerfinance = Boolean(data.isOwnerfinance);
  const isCashDeal = Boolean(data.isCashDeal);

  const arraySaysDeal = dealTypesArray.includes('owner_finance') || dealTypesArray.includes('cash_deal');
  const stringSaysDeal = dealTypeString === 'owner_finance' || dealTypeString === 'cash_deal' || dealTypeString === 'both';
  const boolsSayDeal = isOwnerfinance || isCashDeal;

  if (arraySaysDeal && !stringSaysDeal && !boolsSayDeal) return 'dealtype_mismatch_array_only';
  if (!arraySaysDeal && !stringSaysDeal && !boolsSayDeal) return 'no_dealtype_anywhere';

  return 'unknown_silent_cf_failure';
}

async function main() {
  console.log('\nDIAGNOSING TYPESENSE SYNC GAP\n');

  console.log('Loading Typesense document IDs...');
  const tsIds = await loadTypesenseIds();
  console.log(`  Typesense has ${tsIds.size} documents\n`);

  console.log('Scanning active Firestore properties...');
  const snapshot = await db.collection('properties').where('isActive', '==', true).get();
  console.log(`  Firestore has ${snapshot.size} active properties\n`);

  const missing: MissingRecord[] = [];
  const buckets: Record<string, number> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot.docs.forEach((doc: any) => {
    const data = doc.data();
    const id = doc.id;

    // Only care about properties that SHOULD be indexed (OF or Cash by any field)
    const dealTypesArray = Array.isArray(data.dealTypes) ? data.dealTypes : [];
    const dealTypeString = String(data.dealType || '');
    const qualifies =
      dealTypesArray.includes('owner_finance') ||
      dealTypesArray.includes('cash_deal') ||
      dealTypeString === 'owner_finance' ||
      dealTypeString === 'cash_deal' ||
      dealTypeString === 'both' ||
      Boolean(data.isOwnerfinance) ||
      Boolean(data.isCashDeal);

    if (!qualifies) return;

    if (tsIds.has(id)) return; // It's in Typesense, no problem

    const bucket = bucketFor(data);
    buckets[bucket] = (buckets[bucket] || 0) + 1;

    missing.push({
      id,
      address: String(data.fullAddress || data.address || data.streetAddress || ''),
      state: String(data.state || ''),
      price: Number(data.listPrice || data.price || 0),
      homeStatus: String(data.homeStatus || ''),
      dealTypesArray: dealTypesArray.length ? dealTypesArray : null,
      dealTypeString: dealTypeString || null,
      isOwnerfinance: typeof data.isOwnerfinance === 'boolean' ? data.isOwnerfinance : null,
      isCashDeal: typeof data.isCashDeal === 'boolean' ? data.isCashDeal : null,
      createdAt: data.createdAt ? new Date(data.createdAt._seconds ? data.createdAt._seconds * 1000 : data.createdAt).toISOString() : null,
      source: data.source || null,
      bucket,
    });
  });

  console.log(`Found ${missing.length} qualifying properties missing from Typesense\n`);
  console.log('BREAKDOWN BY ROOT CAUSE:');
  Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .forEach(([bucket, count]) => console.log(`  ${bucket.padEnd(40)} ${count}`));

  console.log('\nSAMPLE FROM EACH BUCKET (3 per bucket):');
  const seen = new Set<string>();
  missing.forEach(m => {
    const key = m.bucket;
    const count = [...seen].filter(s => s.startsWith(key + ':')).length;
    if (count < 3) {
      seen.add(`${key}:${m.id}`);
      console.log(`\n  [${m.bucket}] ${m.id}`);
      console.log(`    ${m.address}, ${m.state}  $${m.price}  status=${m.homeStatus || '(none)'}`);
      console.log(`    dealTypes=${JSON.stringify(m.dealTypesArray)}  dealType=${m.dealTypeString}  OF=${m.isOwnerfinance}  Cash=${m.isCashDeal}`);
      console.log(`    source=${m.source}  created=${m.createdAt}`);
    }
  });

  const reportPath = 'scripts/_typesense-gap-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    summary: { firestoreActive: snapshot.size, typesenseTotal: tsIds.size, missingFromTypesense: missing.length, buckets },
    missing,
  }, null, 2));
  console.log(`\nFull report written to ${reportPath}\n`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
