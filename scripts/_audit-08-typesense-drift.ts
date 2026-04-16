/**
 * Audit #8 — Firestore ↔ Typesense drift.
 * READ-ONLY. Consumes audit-reports/dump-properties.json and audit-reports/dump-typesense.json.
 *
 * Writes:
 *   audit-reports/08-typesense-drift.json
 *   audit-reports/08-typesense-drift.md
 */

import * as fs from 'fs';
import * as path from 'path';

const AUDIT_DIR = path.resolve(__dirname, '..', 'audit-reports');
const FIRESTORE_DUMP = path.join(AUDIT_DIR, 'dump-properties.json');
const TYPESENSE_DUMP = path.join(AUDIT_DIR, 'dump-typesense.json');
const OUT_JSON = path.join(AUDIT_DIR, '08-typesense-drift.json');
const OUT_MD = path.join(AUDIT_DIR, '08-typesense-drift.md');

type FireDoc = Record<string, any>;
type TSDoc = Record<string, any>;

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function norm(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().toLowerCase();
}

function sortedArr(a: any): string[] {
  if (!Array.isArray(a)) return [];
  return [...a].map((x) => String(x)).sort();
}

function sample<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

function main() {
  const fire = loadJson<FireDoc[]>(FIRESTORE_DUMP);
  const ts = loadJson<TSDoc[]>(TYPESENSE_DUMP);

  const fireById = new Map<string, FireDoc>();
  for (const d of fire) {
    const id = d.id || (d.zpid ? `zpid_${d.zpid}` : undefined);
    if (id) fireById.set(id, d);
  }
  const tsById = new Map<string, TSDoc>();
  for (const d of ts) {
    const id = d.id || (d.zpid ? `zpid_${d.zpid}` : undefined);
    if (id) tsById.set(id, d);
  }

  const totalFire = fireById.size;
  const totalTS = tsById.size;

  // Expected-in-Typesense: active + dealTypes non-empty
  const expectedFireIds: string[] = [];
  for (const [id, d] of fireById) {
    const active = d.isActive === true;
    const dt = Array.isArray(d.dealTypes) ? d.dealTypes : [];
    if (active && dt.length > 0) expectedFireIds.push(id);
  }

  const overlap = expectedFireIds.filter((id) => tsById.has(id));
  const missingFromTS = expectedFireIds.filter((id) => !tsById.has(id));

  // Orphans: Typesense docs not in Firestore
  const orphanTS: string[] = [];
  for (const id of tsById.keys()) {
    if (!fireById.has(id)) orphanTS.push(id);
  }

  // Orphaned index entries: in Typesense but Firestore isActive === false
  const inactiveButIndexed: string[] = [];
  for (const id of tsById.keys()) {
    const f = fireById.get(id);
    if (f && f.isActive === false) inactiveButIndexed.push(id);
  }

  // Field drift for docs in BOTH
  const driftCounters = {
    price: 0,
    dealTypes: 0,
    isOwnerFinance: 0,
    isCashDeal: 0,
    city: 0,
    state: 0,
    zipCode: 0,
    homeType: 0,
  };
  const driftExamples: Record<string, Array<{ id: string; firestore: any; typesense: any }>> = {
    price: [],
    dealTypes: [],
    isOwnerFinance: [],
    isCashDeal: [],
    city: [],
    state: [],
    zipCode: [],
    homeType: [],
  };

  for (const [id, f] of fireById) {
    const t = tsById.get(id);
    if (!t) continue;

    // price
    const firePrice = f.price ?? f.listPrice ?? null;
    const tsPrice = t.listPrice ?? t.price ?? null;
    if (firePrice !== null && tsPrice !== null && Number(firePrice) !== Number(tsPrice)) {
      driftCounters.price++;
      if (driftExamples.price.length < 10)
        driftExamples.price.push({ id, firestore: firePrice, typesense: tsPrice });
    }

    // dealTypes — Firestore has array, Typesense has single `dealType` string
    const fireDT = sortedArr(f.dealTypes);
    const tsDT = sortedArr(t.dealTypes ?? (t.dealType ? [t.dealType] : []));
    if (JSON.stringify(fireDT) !== JSON.stringify(tsDT)) {
      driftCounters.dealTypes++;
      if (driftExamples.dealTypes.length < 10)
        driftExamples.dealTypes.push({ id, firestore: fireDT, typesense: tsDT });
    }

    // isOwnerFinance / isOwnerfinance — either casing
    const fireOF = f.isOwnerFinance ?? f.isOwnerfinance;
    const tsOF = t.isOwnerFinance ?? t.isOwnerfinance;
    // If Typesense uses financingType instead, consider owner_finance dealType as truth
    const tsOFFromDealType = tsDT.includes('owner_finance');
    const tsOFNorm = tsOF !== undefined ? !!tsOF : tsOFFromDealType;
    if (fireOF !== undefined && !!fireOF !== tsOFNorm) {
      driftCounters.isOwnerFinance++;
      if (driftExamples.isOwnerFinance.length < 10)
        driftExamples.isOwnerFinance.push({ id, firestore: !!fireOF, typesense: tsOFNorm });
    }

    // isCashDeal
    const fireCD = f.isCashDeal;
    const tsCD = t.isCashDeal ?? tsDT.includes('cash_deal');
    if (fireCD !== undefined && !!fireCD !== !!tsCD) {
      driftCounters.isCashDeal++;
      if (driftExamples.isCashDeal.length < 10)
        driftExamples.isCashDeal.push({ id, firestore: !!fireCD, typesense: !!tsCD });
    }

    // city / state / zipCode
    for (const field of ['city', 'state', 'zipCode'] as const) {
      if (f[field] !== undefined && t[field] !== undefined && norm(f[field]) !== norm(t[field])) {
        driftCounters[field]++;
        if (driftExamples[field].length < 10)
          driftExamples[field].push({ id, firestore: f[field], typesense: t[field] });
      }
    }

    // homeType — Firestore has raw `homeType` (SINGLE_FAMILY) and `propertyType`;
    // Typesense has `propertyType` normalized (single-family). Compare normalized.
    const fireHT = norm(f.homeType ?? f.propertyType).replace(/_/g, '-');
    const tsHT = norm(t.homeType ?? t.propertyType).replace(/_/g, '-');
    if (fireHT && tsHT && fireHT !== tsHT) {
      driftCounters.homeType++;
      if (driftExamples.homeType.length < 10)
        driftExamples.homeType.push({ id, firestore: f.homeType ?? f.propertyType, typesense: t.homeType ?? t.propertyType });
    }
  }

  // Q5: Firestore active + owner_finance in dealTypes → missing from TS OR TS missing owner_finance
  const ofActiveFire: string[] = [];
  for (const [id, d] of fireById) {
    if (d.isActive === true && Array.isArray(d.dealTypes) && d.dealTypes.includes('owner_finance')) {
      ofActiveFire.push(id);
    }
  }
  const ofMissingFromTS: string[] = [];
  const ofTSMissingFlag: string[] = [];
  for (const id of ofActiveFire) {
    const t = tsById.get(id);
    if (!t) {
      ofMissingFromTS.push(id);
      continue;
    }
    const tsDT = sortedArr(t.dealTypes ?? (t.dealType ? [t.dealType] : []));
    if (!tsDT.includes('owner_finance')) ofTSMissingFlag.push(id);
  }

  // Q6: source distribution for Firestore docs missing from Typesense (restricted to expected)
  const missingBySource: Record<string, number> = {};
  for (const id of missingFromTS) {
    const f = fireById.get(id);
    const src = (f && (f.source || f.sourceType)) || 'UNKNOWN';
    missingBySource[String(src)] = (missingBySource[String(src)] || 0) + 1;
  }
  const missingBySourceSorted = Object.entries(missingBySource).sort((a, b) => b[1] - a[1]);

  const result = {
    generatedAt: new Date().toISOString(),
    headline: {
      totalFirestoreDocs: totalFire,
      totalTypesenseDocs: totalTS,
      expectedInTypesense: expectedFireIds.length,
      actualOverlap: overlap.length,
      missingFromTypesense: missingFromTS.length,
      orphanedInTypesense: orphanTS.length,
      inactiveButIndexed: inactiveButIndexed.length,
    },
    missingFromTypesense: {
      count: missingFromTS.length,
      first30: sample(missingFromTS, 30),
      bySource: Object.fromEntries(missingBySourceSorted),
    },
    orphanedInTypesense: {
      count: orphanTS.length,
      first30: sample(orphanTS, 30),
    },
    inactiveButIndexed: {
      count: inactiveButIndexed.length,
      first30: sample(inactiveButIndexed, 30),
    },
    fieldDrift: {
      counters: driftCounters,
      examples: driftExamples,
    },
    ownerFinanceDrift: {
      firestoreActiveOwnerFinanceCount: ofActiveFire.length,
      missingFromTypesense: {
        count: ofMissingFromTS.length,
        first30: sample(ofMissingFromTS, 30),
      },
      inTypesenseButMissingOwnerFinanceFlag: {
        count: ofTSMissingFlag.length,
        first30: sample(ofTSMissingFlag, 30),
      },
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));

  // Markdown report
  const md: string[] = [];
  md.push('# Audit 08 — Firestore ↔ Typesense Drift');
  md.push('');
  md.push(`Generated: ${result.generatedAt}`);
  md.push('');
  md.push('## Headline Counts');
  md.push('');
  md.push(`- Total Firestore docs: **${result.headline.totalFirestoreDocs}**`);
  md.push(`- Total Typesense docs: **${result.headline.totalTypesenseDocs}**`);
  md.push(`- Expected-in-Typesense (active + dealTypes non-empty): **${result.headline.expectedInTypesense}**`);
  md.push(`- Actual overlap (expected AND indexed): **${result.headline.actualOverlap}**`);
  md.push(`- Missing from Typesense (expected but not indexed): **${result.headline.missingFromTypesense}**`);
  md.push(`- Orphans (in Typesense, not in Firestore): **${result.headline.orphanedInTypesense}**`);
  md.push(`- In Typesense but Firestore isActive === false: **${result.headline.inactiveButIndexed}**`);
  md.push('');
  md.push('## Missing from Typesense — source distribution');
  md.push('');
  for (const [src, n] of missingBySourceSorted) {
    md.push(`- \`${src}\`: ${n}`);
  }
  md.push('');
  md.push('### Missing from Typesense — first 30 IDs');
  md.push('');
  md.push(result.missingFromTypesense.first30.map((id) => `- ${id}`).join('\n'));
  md.push('');
  md.push('## Orphans in Typesense — first 30 IDs');
  md.push('');
  md.push(result.orphanedInTypesense.first30.map((id) => `- ${id}`).join('\n') || '_none_');
  md.push('');
  md.push('## In Typesense but Firestore isActive === false — first 30 IDs');
  md.push('');
  md.push(result.inactiveButIndexed.first30.map((id) => `- ${id}`).join('\n') || '_none_');
  md.push('');
  md.push('## Field-value drift (docs present in both)');
  md.push('');
  md.push('| Field | Drift count |');
  md.push('|---|---:|');
  for (const [k, v] of Object.entries(driftCounters)) {
    md.push(`| ${k} | ${v} |`);
  }
  md.push('');
  for (const [k, ex] of Object.entries(driftExamples)) {
    if (!ex.length) continue;
    md.push(`### ${k} — examples`);
    md.push('');
    for (const e of ex) {
      md.push(`- \`${e.id}\`: firestore=\`${JSON.stringify(e.firestore)}\` typesense=\`${JSON.stringify(e.typesense)}\``);
    }
    md.push('');
  }
  md.push('## Owner-finance drift (most user-visible)');
  md.push('');
  md.push(`- Firestore active + owner_finance dealType: **${result.ownerFinanceDrift.firestoreActiveOwnerFinanceCount}**`);
  md.push(`- Missing from Typesense: **${result.ownerFinanceDrift.missingFromTypesense.count}**`);
  md.push(`- In Typesense but owner_finance flag missing: **${result.ownerFinanceDrift.inTypesenseButMissingOwnerFinanceFlag.count}**`);
  md.push('');
  md.push('### owner_finance missing-from-Typesense — first 30');
  md.push('');
  md.push(result.ownerFinanceDrift.missingFromTypesense.first30.map((id) => `- ${id}`).join('\n') || '_none_');
  md.push('');
  md.push('### owner_finance in Typesense w/ flag missing — first 30');
  md.push('');
  md.push(result.ownerFinanceDrift.inTypesenseButMissingOwnerFinanceFlag.first30.map((id) => `- ${id}`).join('\n') || '_none_');
  md.push('');

  fs.writeFileSync(OUT_MD, md.join('\n'));

  // Console summary
  console.log(JSON.stringify(result.headline, null, 2));
  console.log('missing-by-source:', missingBySourceSorted);
  console.log('drift counters:', driftCounters);
}

main();
