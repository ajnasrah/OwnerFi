/**
 * Run the CURRENT production filter against the 4 false positives to
 * determine whether the filter already catches them (historical bug)
 * or whether it still misclassifies them (needs improvement).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';
import { detectNegativeFinancing } from '../src/lib/negative-financing-detector';

const FP_ZPIDS = ['42259256', '55302688', '946846', '72811491'];

async function main() {
  const { db } = getFirebaseAdmin();
  for (const zpid of FP_ZPIDS) {
    const doc = await db.collection('properties').doc(`zpid_${zpid}`).get();
    if (!doc.exists) { console.log(`${zpid}: NOT FOUND`); continue; }
    const d = doc.data()!;
    const desc: string = d.description || '';

    console.log('='.repeat(70));
    console.log(`zpid=${zpid}  addr=${d.streetAddress}  zip=${d.zipCode}`);
    console.log(`isOwnerfinance (stored): ${d.isOwnerfinance}`);
    console.log(`Description: ${desc.slice(0, 300)}${desc.length > 300 ? '…' : ''}`);

    const neg = detectNegativeFinancing(desc);
    console.log(`\nNegative detector: isNegative=${neg.isNegative}, reason="${neg.reason}", match="${neg.matchedPattern || ''}"`);

    const result = runUnifiedFilter(desc, d.listPrice || d.price, d.zestimate || d.estimate, d.propertyType || d.homeType);
    console.log(`Unified filter:    isOwnerfinance=${result.isOwnerfinance}  isCashDeal=${result.isCashDeal}`);
    console.log();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
