/**
 * Audit: of the properties currently flagged isOwnerfinance=true in the
 * 59 target zips, how many have a NEGATED OF mention in the description
 * (e.g. "No owner financing", "seller will NOT carry")? These are
 * false-positives that should be un-flagged.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';

const STRICT_KEYWORDS = [
  'owner financing', 'seller financing',
  'owner carry', 'seller carry',
  'owner terms', 'seller terms',
  'rent to own', 'lease option', 'lease-to-own', 'lease to own',
  'contract for deed', 'land contract',
  'assumable loan', 'no bank needed',
];

const NEGATION_BEFORE = /\b(no|not|without|won't|wont|can't|cannot|never|reject(?:s|ed|ing)?|decline[ds]?|refuse[ds]?|will reject|will not|no (?:wholesale|creative|owner|seller|cash)[,\s]+(?:\w+[,\s]+)*)/i;

function isNegatedMention(desc: string, keyword: string): boolean {
  const lower = desc.toLowerCase();
  const idx = lower.indexOf(keyword.toLowerCase());
  if (idx === -1) return false;
  const before = desc.slice(Math.max(0, idx - 60), idx);
  return NEGATION_BEFORE.test(before);
}

async function main() {
  const { db } = getFirebaseAdmin();
  console.log(`Auditing isOwnerfinance=true flags in ${TARGETED_CASH_ZIPS.length} zips...\n`);

  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) {
    chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));
  }

  const truePositives: Array<{ zpid: string; address: string; zip: string; keyword: string; snippet: string }> = [];
  const falsePositives: Array<{ zpid: string; address: string; zip: string; keyword: string; snippet: string }> = [];

  for (const chunk of chunks) {
    const snap = await db.collection('properties')
      .where('zipCode', 'in', chunk)
      .where('isOwnerfinance', '==', true)
      .get();

    snap.forEach(doc => {
      const d = doc.data();
      const desc: string = d.description || '';

      // Find which strict keyword matched and check if negated
      const matchedKeyword = STRICT_KEYWORDS.find(kw => desc.toLowerCase().includes(kw));
      if (!matchedKeyword) return; // no keyword in desc (shouldn't happen)

      const idx = desc.toLowerCase().indexOf(matchedKeyword.toLowerCase());
      const snippet = '…' + desc.slice(Math.max(0, idx - 80), Math.min(desc.length, idx + matchedKeyword.length + 60)).replace(/\s+/g, ' ').trim() + '…';

      const rec = {
        zpid: d.zpid || doc.id,
        address: d.streetAddress || d.fullAddress || '',
        zip: d.zipCode || '',
        keyword: matchedKeyword,
        snippet,
      };

      if (isNegatedMention(desc, matchedKeyword)) {
        falsePositives.push(rec);
      } else {
        truePositives.push(rec);
      }
    });
  }

  console.log(`TRUE positives (real OF listings):  ${truePositives.length}`);
  console.log(`FALSE positives (negated mentions): ${falsePositives.length}\n`);

  if (falsePositives.length > 0) {
    console.log('FALSE POSITIVES (should un-flag):');
    falsePositives.forEach(r => {
      console.log(`  ${r.zpid} | ${r.address} (${r.zip})`);
      console.log(`  keyword: "${r.keyword}"`);
      console.log(`  ${r.snippet}\n`);
    });
  }

  if (truePositives.length > 0) {
    console.log('\nTRUE POSITIVES (real OF listings):');
    truePositives.forEach(r => {
      console.log(`  ${r.zpid} | ${r.address} (${r.zip}) — "${r.keyword}"`);
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
