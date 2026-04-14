/**
 * Audit: scan all property descriptions in the 59 targeted zips for ANY
 * financing-related language — broader than the production filter — to
 * see what the strict filter is missing.
 *
 * Prints:
 *   - How many descriptions exist / are empty
 *   - How many match broad OF patterns but failed the strict filter
 *   - Sample matches with address, keyword, snippet
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';

// Production strict keywords (mirror of owner-financing-filter-strict.ts)
const STRICT_KEYWORDS = [
  'owner financing', 'seller financing',
  'owner carry', 'seller carry',
  'owner terms', 'seller terms',
  'rent to own', 'lease option', 'lease-to-own', 'lease to own',
  'contract for deed', 'land contract',
  'assumable loan', 'no bank needed',
];

// Broader patterns — if ANY of these hit but strict didn't, it's worth reviewing
const BROAD_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'owner-finance', re: /owner[- ]financ/i },
  { label: 'seller-finance', re: /seller[- ]financ/i },
  { label: 'owner-carry/-back', re: /owner[- ](carry|carries|carry-back|carries-back|will carry)/i },
  { label: 'seller-carry/-back', re: /seller[- ](carry|carries|carry-back|carries-back|will carry)/i },
  { label: 'owner/seller terms', re: /(owner|seller)[- ]terms/i },
  { label: 'rent-to-own', re: /rent[- ]to[- ]own/i },
  { label: 'lease option', re: /lease[- ]option/i },
  { label: 'contract for deed', re: /contract for deed|CFD\b/i },
  { label: 'land contract', re: /land contract/i },
  { label: 'assumable', re: /assumabl/i },
  { label: 'no bank', re: /no bank|no banks/i },
  { label: 'creative financing', re: /creative financ/i },
  { label: 'flexible terms', re: /flexible (terms|financing)/i },
  { label: 'will finance', re: /will finance/i },
  { label: 'financing available', re: /financing (available|offered)/i },
  { label: 'wrap mortgage', re: /wrap[- ]?(around)?[- ]?mortgage|wrap loan/i },
  { label: 'assume mortgage', re: /assume (the|my|existing|current)? ?(mortgage|loan|payments?)/i },
  { label: 'subject-to', re: /\bsubject[- ]to\b/i },
  { label: 'no qualifying', re: /no qualifying|no qualification/i },
  { label: 'no credit check', re: /no credit check/i },
  { label: 'in-house financing', re: /in[- ]?house financing/i },
  { label: 'owner will finance', re: /owner will (finance|carry|consider)/i },
  { label: 'seller will finance', re: /seller will (finance|carry|consider)/i },
  { label: 'bank owned', re: /bank[- ]?owned|REO/i },
  { label: 'investor special', re: /investor(s)? special|investor(s)? welcome|cash buyer/i },
];

function containsStrictKeyword(desc: string): boolean {
  const lower = desc.toLowerCase();
  return STRICT_KEYWORDS.some(kw => lower.includes(kw));
}

function matchBroadPatterns(desc: string): string[] {
  return BROAD_PATTERNS.filter(p => p.re.test(desc)).map(p => p.label);
}

function snippet(desc: string, re: RegExp, pad = 60): string {
  const m = desc.match(re);
  if (!m || m.index === undefined) return '';
  const start = Math.max(0, m.index - pad);
  const end = Math.min(desc.length, m.index + m[0].length + pad);
  return '…' + desc.slice(start, end).replace(/\s+/g, ' ').trim() + '…';
}

async function main() {
  const { db } = getFirebaseAdmin();
  console.log(`Scanning descriptions across ${TARGETED_CASH_ZIPS.length} zips...`);

  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) {
    chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));
  }

  let total = 0;
  let empty = 0;
  let strictHits = 0;
  let broadOnly = 0; // broad matched but strict missed
  const broadByLabel: Record<string, number> = {};
  const samples: Array<{ zpid: string; address: string; zip: string; labels: string[]; snip: string; isOwnerfinance: boolean }> = [];

  for (const chunk of chunks) {
    const snap = await db.collection('properties')
      .where('zipCode', 'in', chunk)
      .get();

    snap.forEach(doc => {
      const d = doc.data();
      total++;
      const desc: string = d.description || '';
      if (!desc.trim()) { empty++; return; }

      const strict = containsStrictKeyword(desc);
      if (strict) strictHits++;

      const broadLabels = matchBroadPatterns(desc);
      if (broadLabels.length === 0) return;

      broadLabels.forEach(l => { broadByLabel[l] = (broadByLabel[l] || 0) + 1; });

      if (!strict) {
        broadOnly++;
        if (samples.length < 30) {
          const firstLabel = broadLabels[0];
          const firstPattern = BROAD_PATTERNS.find(p => p.label === firstLabel)!;
          samples.push({
            zpid: d.zpid || doc.id,
            address: d.streetAddress || d.fullAddress || '',
            zip: d.zipCode || '',
            labels: broadLabels,
            snip: snippet(desc, firstPattern.re),
            isOwnerfinance: !!d.isOwnerfinance,
          });
        }
      }
    });
  }

  console.log(`\nTotal properties scanned: ${total}`);
  console.log(`  Empty descriptions:      ${empty}`);
  console.log(`  Strict filter hits:      ${strictHits}`);
  console.log(`  Broad matches:           ${Object.values(broadByLabel).reduce((a, b) => a + b, 0)}`);
  console.log(`  Broad-but-strict-missed: ${broadOnly}`);

  console.log('\nBroad pattern counts:');
  Object.entries(broadByLabel)
    .sort((a, b) => b[1] - a[1])
    .forEach(([l, c]) => console.log(`  ${l}: ${c}`));

  if (samples.length > 0) {
    console.log('\nSamples (broad match, strict filter missed):');
    samples.forEach(s => {
      console.log(`\n  ${s.zpid} | ${s.address} (${s.zip}) | isOwnerfinance=${s.isOwnerfinance}`);
      console.log(`  labels: ${s.labels.join(', ')}`);
      console.log(`  snippet: ${s.snip}`);
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
