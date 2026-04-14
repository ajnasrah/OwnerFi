/**
 * Check: how many properties currently in Firestore (across the 59
 * targeted zips) are flagged isOwnerfinance=true?
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';

async function main() {
  const { db } = getFirebaseAdmin();

  console.log(`Checking ${TARGETED_CASH_ZIPS.length} zips...`);

  // Firestore `in` query supports max 30 values per query — chunk
  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) {
    chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));
  }

  const perZip: Record<string, { total: number; of: number; cash: number }> = {};
  let totalProps = 0;
  let totalOF = 0;
  let totalCash = 0;
  const ofSamples: Array<{ zpid: string; address: string; zip: string; keywords: string[] }> = [];

  for (const chunk of chunks) {
    const snap = await db.collection('properties')
      .where('zipCode', 'in', chunk)
      .get();

    snap.forEach(doc => {
      const d = doc.data();
      const zip = d.zipCode;
      if (!perZip[zip]) perZip[zip] = { total: 0, of: 0, cash: 0 };
      perZip[zip].total++;
      totalProps++;
      if (d.isOwnerfinance) {
        perZip[zip].of++;
        totalOF++;
        if (ofSamples.length < 20) {
          ofSamples.push({
            zpid: d.zpid || doc.id,
            address: d.streetAddress || d.fullAddress || '',
            zip,
            keywords: d.ownerFinanceKeywords || d.ownerFinance?.matchedKeywords || [],
          });
        }
      }
      if (d.isCashDeal) {
        perZip[zip].cash++;
        totalCash++;
      }
    });
  }

  console.log('\nPER-ZIP BREAKDOWN (only zips with any property in DB):');
  Object.entries(perZip)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([zip, s]) => {
      console.log(`  ${zip}: total=${s.total}  OF=${s.of}  cash=${s.cash}`);
    });

  console.log(`\nTotals across all ${TARGETED_CASH_ZIPS.length} target zips:`);
  console.log(`  Properties in Firestore: ${totalProps}`);
  console.log(`  isOwnerfinance=true:     ${totalOF}`);
  console.log(`  isCashDeal=true:         ${totalCash}`);

  if (ofSamples.length > 0) {
    console.log('\nOF property samples:');
    ofSamples.forEach(s => {
      console.log(`  ${s.zpid} | ${s.address} (${s.zip}) | keywords: ${s.keywords.join(', ')}`);
    });
  } else {
    console.log('\n❌ No owner-finance properties found in any of the 59 target zips.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
