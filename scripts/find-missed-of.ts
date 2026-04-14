/**
 * Find TRUE false negatives: property descriptions that mention OF-style
 * financing positively (not "No owner finance" style negations) but were
 * missed by the strict filter.
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

// OF-indicative phrases
const OF_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'owner finance/financed', re: /\bowner[- ](finance[ds]?|financing)\b/i },
  { label: 'seller finance/financed', re: /\bseller[- ](finance[ds]?|financing)\b/i },
  { label: 'owner will finance/carry', re: /owner will (finance|carry|consider financ)/i },
  { label: 'seller will finance/carry', re: /seller will (finance|carry|consider financ)/i },
  { label: 'will finance', re: /\bwill finance\b/i },
  { label: 'in-house financing', re: /in[- ]?house financing/i },
  { label: 'assumable', re: /\bassumabl/i },
  { label: 'wrap mortgage', re: /wrap[- ]?around[- ]?(mortgage|loan)|wrap mortgage/i },
  { label: 'subject-to', re: /\bsubject[- ]to\b(?!.{0,20}(inspection|appraisal|financing approval))/i },
  { label: 'contract for deed', re: /contract for deed/i },
  { label: 'land contract', re: /land contract/i },
  { label: 'rent to own', re: /rent[- ]to[- ]own/i },
  { label: 'lease option', re: /lease[- ]option/i },
  { label: 'no qualifying', re: /no qualifying|no qualification/i },
  { label: 'no credit check', re: /no credit check/i },
];

// Negation detection — scan 30 chars BEFORE the match for these
const NEGATION_BEFORE = /\b(no|not|without|won't|wont|can't|cannot|never|reject(?:s|ed|ing)?|decline[ds]?|refuse[ds]?|will reject|will not)\b[^.!?]{0,30}$/i;

function containsStrict(desc: string): boolean {
  const lower = desc.toLowerCase();
  return STRICT_KEYWORDS.some(kw => lower.includes(kw));
}

function findPositiveOFMentions(desc: string): Array<{ label: string; snippet: string }> {
  const out: Array<{ label: string; snippet: string }> = [];
  for (const p of OF_PATTERNS) {
    const m = desc.match(p.re);
    if (!m || m.index === undefined) continue;

    // Check preceding text for negation
    const before = desc.slice(Math.max(0, m.index - 40), m.index);
    if (NEGATION_BEFORE.test(before)) continue; // negated — skip

    const start = Math.max(0, m.index - 60);
    const end = Math.min(desc.length, m.index + m[0].length + 60);
    const snippet = '…' + desc.slice(start, end).replace(/\s+/g, ' ').trim() + '…';
    out.push({ label: p.label, snippet });
  }
  return out;
}

async function main() {
  const { db } = getFirebaseAdmin();
  console.log(`Scanning ${TARGETED_CASH_ZIPS.length} zips for TRUE false negatives...\n`);

  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) {
    chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));
  }

  const missed: Array<{ zpid: string; address: string; zip: string; url?: string; labels: string[]; snippets: string[] }> = [];
  let total = 0;

  for (const chunk of chunks) {
    const snap = await db.collection('properties')
      .where('zipCode', 'in', chunk)
      .get();

    snap.forEach(doc => {
      total++;
      const d = doc.data();
      const desc: string = d.description || '';
      if (!desc.trim()) return;
      if (containsStrict(desc)) return; // already flagged, skip
      if (d.isOwnerfinance) return;

      const positive = findPositiveOFMentions(desc);
      if (positive.length === 0) return;

      missed.push({
        zpid: d.zpid || doc.id,
        address: d.streetAddress || d.fullAddress || '',
        zip: d.zipCode || '',
        url: d.url,
        labels: [...new Set(positive.map(p => p.label))],
        snippets: positive.map(p => p.snippet),
      });
    });
  }

  console.log(`Scanned ${total} properties`);
  console.log(`TRUE false negatives (positive OF language, missed by strict): ${missed.length}\n`);

  missed.forEach(m => {
    console.log(`${m.zpid} | ${m.address} (${m.zip})`);
    console.log(`  labels: ${m.labels.join(', ')}`);
    m.snippets.slice(0, 2).forEach(s => console.log(`  ${s}`));
    if (m.url) console.log(`  ${m.url}`);
    console.log();
  });
}

main().catch(e => { console.error(e); process.exit(1); });
