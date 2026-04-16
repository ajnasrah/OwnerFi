/**
 * Audit #3: Deal Type Flag Consistency
 * READ-ONLY — no writes to Firestore or external services
 */

import * as fs from 'fs';
import * as path from 'path';

const DUMP_PATH = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const OUT_JSON = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/03-deal-flags.json';
const OUT_MD = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/03-deal-flags.md';

const KNOWN_DEAL_TYPES = new Set(['owner_finance', 'cash_deal']);

// Values of `financingType` that should trigger owner_finance presence
const OF_FINANCING_RE = /\b(owner\s*fin|seller\s*fin|owner[-_]?financ|seller[-_]?financ|subject[-\s]?to|sub[-\s]?to|wrap|land\s*contract|contract\s*for\s*deed|cfd|lease[-\s]?option|lease[-\s]?purchase|rent[-\s]?to[-\s]?own|rto|assumable)\b/i;

type Doc = Record<string, any> & { id?: string; _id?: string };

function getId(d: Doc): string {
  return d.id || d._id || d.docId || d.propertyId || '(unknown)';
}

function isOFFinancingType(v: any): boolean {
  if (!v) return false;
  if (typeof v === 'string') return OF_FINANCING_RE.test(v);
  return false;
}

function anyOFInAllFinancing(arr: any): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.some((x) => typeof x === 'string' && OF_FINANCING_RE.test(x));
}

function main() {
  const raw = fs.readFileSync(DUMP_PATH, 'utf8');
  const docs: Doc[] = JSON.parse(raw);
  console.log(`Loaded ${docs.length} docs`);

  const v1: string[] = []; // dealTypes has OF but isOwnerfinance !== true
  const v2: string[] = []; // isOwnerfinance === true but dealTypes missing OF
  const v3: string[] = []; // dealTypes has cash but isCashDeal !== true
  const v4: string[] = []; // isCashDeal true but dealTypes missing cash
  const v5: string[] = []; // ownerFinanceVerified true but dealTypes missing OF
  const v6: string[] = []; // agentConfirmedOwnerfinance true but dealTypes missing OF
  const v7: string[] = []; // financingType OF-like but dealTypes missing OF
  const v8: string[] = []; // empty dealTypes AND isActive AND source in scraper-v2/agent_outreach
  const v9: string[] = []; // both flags false but dealTypes has entries
  const v10: Array<{ id: string; unknown: string[] }> = []; // unknown dealTypes entries

  for (const d of docs) {
    const id = getId(d);
    const dealTypes: string[] = Array.isArray(d.dealTypes) ? d.dealTypes : [];
    const hasOF = dealTypes.includes('owner_finance');
    const hasCash = dealTypes.includes('cash_deal');
    const isOF = d.isOwnerfinance === true;
    const isCash = d.isCashDeal === true;

    // 1
    if (hasOF && !isOF) v1.push(id);
    // 2
    if (isOF && !hasOF) v2.push(id);
    // 3
    if (hasCash && !isCash) v3.push(id);
    // 4
    if (isCash && !hasCash) v4.push(id);
    // 5
    if (d.ownerFinanceVerified === true && !hasOF) v5.push(id);
    // 6
    if (d.agentConfirmedOwnerfinance === true && !hasOF) v6.push(id);
    // 7
    if ((isOFFinancingType(d.financingType) || anyOFInAllFinancing(d.allFinancingTypes)) && !hasOF) {
      v7.push(id);
    }
    // 8
    if (
      dealTypes.length === 0 &&
      d.isActive === true &&
      (d.source === 'scraper-v2' || d.source === 'agent_outreach')
    ) {
      v8.push(id);
    }
    // 9
    if (!isOF && !isCash && dealTypes.length > 0) v9.push(id);
    // 10
    const unknown = dealTypes.filter((t) => !KNOWN_DEAL_TYPES.has(t));
    if (unknown.length > 0) v10.push({ id, unknown });
  }

  const result = {
    totalDocs: docs.length,
    violations: {
      v1_dealTypesOF_but_flagMissing: { count: v1.length, ids: v1.slice(0, 20) },
      v2_flagOF_but_dealTypesMissing: { count: v2.length, ids: v2.slice(0, 20) },
      v3_dealTypesCash_but_flagMissing: { count: v3.length, ids: v3.slice(0, 20) },
      v4_flagCash_but_dealTypesMissing: { count: v4.length, ids: v4.slice(0, 20) },
      v5_ownerFinanceVerified_but_dealTypesMissing: { count: v5.length, ids: v5.slice(0, 20) },
      v6_agentConfirmedOF_but_dealTypesMissing: { count: v6.length, ids: v6.slice(0, 20) },
      v7_financingTypeOF_but_dealTypesMissing: { count: v7.length, ids: v7.slice(0, 20) },
      v8_emptyDealTypes_activeScraperOrOutreach: { count: v8.length, ids: v8.slice(0, 20) },
      v9_bothFlagsFalse_but_dealTypesNonEmpty: { count: v9.length, ids: v9.slice(0, 20) },
      v10_unknown_dealTypes: { count: v10.length, samples: v10.slice(0, 20) },
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
  console.log(`Wrote ${OUT_JSON}`);

  const counts = [
    ['v1 dealTypes has OF but isOwnerfinance !== true', v1.length],
    ['v2 isOwnerfinance true but dealTypes missing owner_finance', v2.length],
    ['v3 dealTypes has cash but isCashDeal !== true', v3.length],
    ['v4 isCashDeal true but dealTypes missing cash_deal', v4.length],
    ['v5 ownerFinanceVerified true but dealTypes missing owner_finance', v5.length],
    ['v6 agentConfirmedOwnerfinance true but dealTypes missing owner_finance', v6.length],
    ['v7 financingType/allFinancingTypes OF-like but dealTypes missing owner_finance', v7.length],
    ['v8 empty dealTypes + active + source scraper-v2/agent_outreach', v8.length],
    ['v9 both flags false but dealTypes non-empty', v9.length],
    ['v10 unknown dealTypes strings', v10.length],
  ] as const;

  const md: string[] = [];
  md.push(`# Audit #3: Deal Type Flag Consistency`);
  md.push('');
  md.push(`Total docs scanned: **${docs.length}**`);
  md.push('');
  md.push(`## Counts`);
  md.push('');
  md.push(`| # | Violation | Count |`);
  md.push(`|---|-----------|------:|`);
  counts.forEach(([label, n], i) => md.push(`| v${i + 1} | ${label} | ${n} |`));
  md.push('');

  const detail = (title: string, ids: string[]) => {
    md.push(`### ${title} — ${ids.length}`);
    md.push('');
    if (ids.length === 0) {
      md.push(`_none_`);
    } else {
      md.push('First 20 IDs:');
      md.push('');
      ids.slice(0, 20).forEach((x) => md.push(`- \`${x}\``));
    }
    md.push('');
  };

  detail('v1 — dealTypes has owner_finance but isOwnerfinance !== true', v1);
  detail('v2 — isOwnerfinance === true but dealTypes missing owner_finance', v2);
  detail('v3 — dealTypes has cash_deal but isCashDeal !== true', v3);
  detail('v4 — isCashDeal === true but dealTypes missing cash_deal', v4);
  detail('v5 — ownerFinanceVerified === true but dealTypes missing owner_finance', v5);
  detail('v6 — agentConfirmedOwnerfinance === true but dealTypes missing owner_finance', v6);
  detail('v7 — financingType OF-like but dealTypes missing owner_finance', v7);
  detail('v8 — empty dealTypes + isActive + source scraper-v2/agent_outreach', v8);
  detail('v9 — both flags false but dealTypes non-empty', v9);

  md.push(`### v10 — unknown dealTypes strings — ${v10.length}`);
  md.push('');
  if (v10.length === 0) {
    md.push(`_none_`);
  } else {
    md.push(`First 20 samples:`);
    md.push('');
    v10.slice(0, 20).forEach((x) => md.push(`- \`${x.id}\` — unknown: ${JSON.stringify(x.unknown)}`));
  }
  md.push('');

  fs.writeFileSync(OUT_MD, md.join('\n'));
  console.log(`Wrote ${OUT_MD}`);

  // print summary
  console.log('\n=== SUMMARY ===');
  counts.forEach(([label, n]) => console.log(`  ${label}: ${n}`));
}

main();
