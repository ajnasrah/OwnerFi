/**
 * Read-only audit: find properties that look like auctions/foreclosures
 * currently sitting in Firestore. Uses multiple signals:
 *   - suspiciousDiscount === true (price < 50% of Zestimate)
 *   - homeStatus in FOR_AUCTION / FORECLOSURE / PRE_FORECLOSURE
 *   - price/zestimate ratio < 0.4 (highest risk)
 *   - zpid_XXXX lookup for a specific property (--zpid=N) or address match
 *
 * No writes. Use to validate that the backfill targets are correct before
 * running it live.
 *
 * Usage:
 *   npx tsx scripts/find-auction-suspects.ts
 *   npx tsx scripts/find-auction-suspects.ts --address="1484 N Trezevant"
 *   npx tsx scripts/find-auction-suspects.ts --zpid=12345678
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const addressArg = process.argv.find(a => a.startsWith('--address='));
const zpidArg = process.argv.find(a => a.startsWith('--zpid='));
const targetAddress = addressArg ? addressArg.split('=')[1].toLowerCase() : null;
const targetZpid = zpidArg ? zpidArg.split('=')[1] : null;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarize(doc: any) {
  const d = doc.data();
  const address = d.streetAddress || d.fullAddress || doc.id;
  const price = d.price || d.listPrice || 0;
  const est = d.estimate || d.zestimate || 0;
  const ratio = est > 0 ? ((price / est) * 100).toFixed(1) : 'n/a';
  return {
    id: doc.id,
    zpid: d.zpid,
    address,
    city: d.city,
    state: d.state,
    price,
    estimate: est,
    ratioPct: ratio,
    homeStatus: d.homeStatus || '',
    isAuction: d.isAuction === true,
    isForeclosure: d.isForeclosure === true,
    isBankOwned: d.isBankOwned === true,
    listingSubType: d.listingSubType || '',
    isOwnerfinance: d.isOwnerfinance === true,
    isCashDeal: d.isCashDeal === true,
    dealTypes: d.dealTypes || [],
    suspiciousDiscount: d.suspiciousDiscount === true,
    url: d.url || `https://www.zillow.com/homedetails/${d.zpid}_zpid/`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printRow(r: any) {
  const flags: string[] = [];
  if (r.isAuction) flags.push('AUCTION');
  if (r.isForeclosure) flags.push('FORECLOSURE');
  if (r.isBankOwned) flags.push('REO');
  if (r.isOwnerfinance) flags.push('OF');
  if (r.isCashDeal) flags.push('CASH');
  if (r.suspiciousDiscount) flags.push('SUSPICIOUS');
  const flagStr = flags.length ? `[${flags.join('|')}]` : '[-]';
  console.log(
    `  ${flagStr.padEnd(35)} $${String(r.price).padStart(8)} / zest $${String(r.estimate).padStart(8)} (${r.ratioPct}%)` +
    `  status=${r.homeStatus || '-'} subType="${r.listingSubType || '-'}"` +
    `\n    ${r.address}, ${r.city}, ${r.state}  id=${r.id}` +
    `\n    ${r.url}`
  );
}

async function main() {
  console.log('\n========== AUCTION / DISTRESSED-LISTING AUDIT ==========\n');

  // 1. Specific lookup if requested
  if (targetZpid) {
    console.log(`Looking up zpid_${targetZpid}...`);
    const doc = await db.collection('properties').doc(`zpid_${targetZpid}`).get();
    if (!doc.exists) {
      console.log(`  Not found.\n`);
    } else {
      printRow(summarize(doc));
      console.log('');
    }
  }

  if (targetAddress) {
    console.log(`Searching streetAddress containing "${targetAddress}"...`);
    // Firestore doesn't do case-insensitive substring search directly; sample & filter
    const snap = await db.collection('properties').limit(2000).get();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches = snap.docs.filter((d: any) => {
      const data = d.data();
      const addr = ((data.streetAddress || '') + ' ' + (data.fullAddress || '')).toLowerCase();
      return addr.includes(targetAddress);
    });
    console.log(`  Found ${matches.length} match(es)`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of matches) printRow(summarize(d));
    console.log('');
  }

  // 2. Properties explicitly tagged as distressed already
  console.log('Already-tagged distressed properties (isAuction=true)...');
  const auctionSnap = await db.collection('properties')
    .where('isAuction', '==', true)
    .limit(50)
    .get();
  console.log(`  ${auctionSnap.size} found`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auctionSnap.docs.slice(0, 10).forEach((d: any) => printRow(summarize(d)));
  console.log('');

  console.log('Already-tagged foreclosures (isForeclosure=true)...');
  const forecSnap = await db.collection('properties')
    .where('isForeclosure', '==', true)
    .limit(50)
    .get();
  console.log(`  ${forecSnap.size} found`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  forecSnap.docs.slice(0, 10).forEach((d: any) => printRow(summarize(d)));
  console.log('');

  // 3. Untagged suspects: suspiciousDiscount=true without any distressed flag
  console.log('SUSPECTS — suspiciousDiscount=true, no distressed flags set:');
  const suspSnap = await db.collection('properties')
    .where('suspiciousDiscount', '==', true)
    .limit(100)
    .get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untagged = suspSnap.docs.filter((d: any) => {
    const data = d.data();
    return !data.isAuction && !data.isForeclosure && !data.isBankOwned;
  });
  console.log(`  ${untagged.length} of ${suspSnap.size} suspicious-discount properties have NO distressed flag yet`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  untagged.slice(0, 15).forEach((d: any) => printRow(summarize(d)));
  console.log('');

  // 4. Distress statuses already in homeStatus field
  console.log('Properties with homeStatus in FOR_AUCTION/FORECLOSED/PRE_FORECLOSURE:');
  const statusSnap = await db.collection('properties')
    .where('homeStatus', 'in', ['FOR_AUCTION', 'FORECLOSED', 'FORECLOSURE', 'PRE_FORECLOSURE'])
    .limit(50)
    .get();
  console.log(`  ${statusSnap.size} found`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statusSnap.docs.slice(0, 10).forEach((d: any) => printRow(summarize(d)));
  console.log('');

  // 5. Consistency check — any property both flagged distressed AND tagged owner_finance?
  console.log('CONSISTENCY CHECK — distressed AND tagged owner_finance (should be 0 after fix):');
  const bothA = await db.collection('properties')
    .where('isAuction', '==', true)
    .where('isOwnerfinance', '==', true)
    .get();
  const bothF = await db.collection('properties')
    .where('isForeclosure', '==', true)
    .where('isOwnerfinance', '==', true)
    .get();
  const bothB = await db.collection('properties')
    .where('isBankOwned', '==', true)
    .where('isOwnerfinance', '==', true)
    .get();
  console.log(`  auction+OF:     ${bothA.size}`);
  console.log(`  foreclosure+OF: ${bothF.size}`);
  console.log(`  bank-owned+OF:  ${bothB.size}`);
  const allBoth = [...bothA.docs, ...bothF.docs, ...bothB.docs];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allBoth.slice(0, 10).forEach((d: any) => printRow(summarize(d)));
  console.log('');

  console.log('========== AUDIT COMPLETE ==========\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
