/**
 * Audit #4: Price / Zestimate sanity.
 * READ-ONLY. Reads dump-properties.json; writes 04-price-sanity.{json,md}.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const DUMP = path.join(ROOT, 'audit-reports', 'dump-properties.json');
const OUT_JSON = path.join(ROOT, 'audit-reports', '04-price-sanity.json');
const OUT_MD = path.join(ROOT, 'audit-reports', '04-price-sanity.md');

type Doc = any;

function arv(d: Doc): number {
  const v = d.zestimate ?? d.estimate ?? d.homeValue;
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

function priceOf(d: Doc): number {
  const p = d.price ?? d.listPrice;
  return typeof p === 'number' && isFinite(p) ? p : 0;
}

function pct(a: number, b: number): number {
  if (b === 0) return Infinity;
  return Math.abs(a - b) / Math.abs(b);
}

function isActive(d: Doc): boolean {
  // Consider status active-ish if not explicitly "sold"/"inactive"/"deleted"
  const s = (d.status || d.listingStatus || '').toString().toLowerCase();
  if (!s) return true;
  if (s.includes('sold') || s.includes('inactive') || s.includes('deleted') || s.includes('off-market') || s.includes('off_market')) return false;
  return true;
}

function main() {
  const raw = fs.readFileSync(DUMP, 'utf-8');
  const docs: Doc[] = JSON.parse(raw);
  console.log(`Loaded ${docs.length} property docs`);

  const cat1: string[] = []; // cash flagged but doesn't qualify
  const cat2: string[] = []; // cash flagged but Zestimate missing
  const cat3: string[] = []; // should qualify but not flagged
  const cat4: string[] = []; // price vs listPrice differ >1%
  const cat5: string[] = []; // junk price (negative/zero/>10M) on active
  const cat6: string[] = []; // priceToZestimateRatio mismatch
  const cat7: string[] = []; // discountPercent mismatch
  const cat8: string[] = []; // eightyPercentOfZestimate mismatch
  const cat9: string[] = []; // huge Zestimate, tiny price
  const cat10: string[] = []; // land + cash deal

  const cat1Detail: any[] = [];
  const cat5Detail: any[] = [];
  const cat9Detail: any[] = [];

  for (const d of docs) {
    const id = d.id;
    const price = priceOf(d);
    const zest = arv(d);
    const isCash = d.isCashDeal === true;
    const isLand = d.isLand === true;

    // 1. isCashDeal but doesn't qualify
    if (isCash && zest > 0 && price > 0 && price >= 0.8 * zest) {
      cat1.push(id);
      cat1Detail.push({ id, price, zest, ratio: +(price / zest).toFixed(4) });
    }

    // 2. isCashDeal but Zestimate missing
    if (isCash && (!zest || zest <= 0)) {
      cat2.push(id);
    }

    // 3. not flagged but should be (need both price and zest)
    if (!isCash && zest > 0 && price > 0 && price < 0.8 * zest) {
      // Filter out land since land isn't valid cash deal territory anyway
      if (!isLand) cat3.push(id);
    }

    // 4. price vs listPrice differ >1%
    if (
      typeof d.price === 'number' &&
      typeof d.listPrice === 'number' &&
      d.price > 0 &&
      d.listPrice > 0 &&
      pct(d.price, d.listPrice) > 0.01
    ) {
      cat4.push(id);
    }

    // 5. junk price on active
    if (isActive(d)) {
      const p = d.price;
      if (typeof p === 'number' && (p < 0 || p === 0 || p > 10_000_000)) {
        cat5.push(id);
        cat5Detail.push({ id, price: p, status: d.status });
      }
    }

    // 6. priceToZestimateRatio mismatch
    if (
      typeof d.priceToZestimateRatio === 'number' &&
      zest > 0 &&
      price > 0
    ) {
      const expected = price / zest;
      if (pct(d.priceToZestimateRatio, expected) > 0.01) {
        cat6.push(id);
      }
    }

    // 7. discountPercent mismatch
    if (
      typeof d.discountPercent === 'number' &&
      zest > 0 &&
      price > 0
    ) {
      const expected = 100 * (1 - price / zest);
      if (Math.abs(d.discountPercent - expected) > 2) {
        cat7.push(id);
      }
    }

    // 8. eightyPercentOfZestimate mismatch
    if (typeof d.eightyPercentOfZestimate === 'number' && zest > 0) {
      const expected = 0.8 * zest;
      if (pct(d.eightyPercentOfZestimate, expected) > 0.01) {
        cat8.push(id);
      }
    }

    // 9. Zestimate >$5M with price <$100k
    if (zest > 5_000_000 && price > 0 && price < 100_000) {
      cat9.push(id);
      cat9Detail.push({ id, price, zest });
    }

    // 10. Land + isCashDeal
    if (isLand && isCash) {
      cat10.push(id);
    }
  }

  const summary = {
    total: docs.length,
    categories: {
      '1_cashDeal_but_doesnt_qualify': { count: cat1.length, firstIds: cat1.slice(0, 20) },
      '2_cashDeal_but_zestimate_missing': { count: cat2.length, firstIds: cat2.slice(0, 20) },
      '3_qualifies_but_not_flagged': { count: cat3.length, firstIds: cat3.slice(0, 20) },
      '4_price_vs_listPrice_diff_gt_1pct': { count: cat4.length, firstIds: cat4.slice(0, 20) },
      '5_junk_price_on_active': { count: cat5.length, firstIds: cat5.slice(0, 20) },
      '6_priceToZestimateRatio_mismatch': { count: cat6.length, firstIds: cat6.slice(0, 20) },
      '7_discountPercent_mismatch': { count: cat7.length, firstIds: cat7.slice(0, 20) },
      '8_eightyPercentOfZestimate_mismatch': { count: cat8.length, firstIds: cat8.slice(0, 20) },
      '9_huge_zest_tiny_price': { count: cat9.length, firstIds: cat9.slice(0, 20) },
      '10_land_with_cashDeal': { count: cat10.length, firstIds: cat10.slice(0, 20) },
    },
    samples: {
      cat1Worst: cat1Detail
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 10),
      cat5Worst: cat5Detail.slice(0, 10),
      cat9Worst: cat9Detail
        .sort((a, b) => b.zest - a.zest)
        .slice(0, 10),
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));

  const md = `# Audit #4: Price / Zestimate Sanity

Total docs scanned: **${docs.length}**

| # | Category | Count |
|---|---|---|
| 1 | \`isCashDeal\` true but price >= 0.8 * zest | ${cat1.length} |
| 2 | \`isCashDeal\` true but zestimate missing/0 | ${cat2.length} |
| 3 | Not flagged cash deal but qualifies (non-land) | ${cat3.length} |
| 4 | \`price\` vs \`listPrice\` differ >1% | ${cat4.length} |
| 5 | Junk price (<=0 or >$10M) on active | ${cat5.length} |
| 6 | \`priceToZestimateRatio\` mismatch >1% | ${cat6.length} |
| 7 | \`discountPercent\` mismatch >2pts | ${cat7.length} |
| 8 | \`eightyPercentOfZestimate\` mismatch >1% | ${cat8.length} |
| 9 | Zest >$5M and price <$100k | ${cat9.length} |
| 10 | Land + \`isCashDeal\` true | ${cat10.length} |

## First 20 IDs per category

${Object.entries(summary.categories)
  .map(
    ([k, v]: any) =>
      `### ${k} (${v.count})\n\n${v.firstIds.length ? v.firstIds.map((i: string) => `- \`${i}\``).join('\n') : '_(none)_'}\n`
  )
  .join('\n')}

## Worst offenders — category 1 (flagged cash, ratio >= 0.8)

${summary.samples.cat1Worst.map((r: any) => `- \`${r.id}\` price=$${r.price.toLocaleString()} zest=$${r.zest.toLocaleString()} ratio=${r.ratio}`).join('\n') || '_(none)_'}

## Worst offenders — category 5 (junk price, active)

${summary.samples.cat5Worst.map((r: any) => `- \`${r.id}\` price=${r.price} status=${r.status}`).join('\n') || '_(none)_'}

## Worst offenders — category 9 (huge zest, tiny price)

${summary.samples.cat9Worst.map((r: any) => `- \`${r.id}\` price=$${r.price.toLocaleString()} zest=$${r.zest.toLocaleString()}`).join('\n') || '_(none)_'}
`;

  fs.writeFileSync(OUT_MD, md);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);

  console.log('\nCounts:');
  for (const [k, v] of Object.entries(summary.categories)) {
    console.log(`  ${k}: ${(v as any).count}`);
  }
}

main();
