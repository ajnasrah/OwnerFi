#!/usr/bin/env npx tsx
/**
 * Audit #9: Lifecycle / Active Status
 * Read-only audit of properties for active status / lifecycle issues.
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const OUT_JSON = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/09-lifecycle.json';
const OUT_MD = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/09-lifecycle.md';

const NOW = new Date('2026-04-16T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const D30 = 30 * DAY;
const D60 = 60 * DAY;
const D90 = 90 * DAY;

function parseDate(v: any): number | null {
  if (!v) return null;
  // Firestore Timestamp-style dump: { _seconds, _nanoseconds } OR { seconds, nanoseconds }
  if (typeof v === 'object') {
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v.toDate === 'function') {
      try {
        return v.toDate().getTime();
      } catch {
        return null;
      }
    }
  }
  if (typeof v === 'number') {
    // ms vs s heuristic
    return v > 1e12 ? v : v * 1000;
  }
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  return null;
}

type Doc = Record<string, any> & { id?: string; _id?: string };

function docId(d: Doc): string {
  return d.id || d._id || d.docId || d.propertyId || '<unknown>';
}

function main() {
  console.log('Loading', INPUT);
  const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  const docs: Doc[] = Array.isArray(raw) ? raw : raw.docs || raw.properties || Object.values(raw);
  console.log(`Loaded ${docs.length} docs`);

  const cat: Record<string, string[]> = {
    '1_activeButSold': [],
    '2_activeButDeleted': [],
    '3_staleOver30': [],
    '4_staleOver90': [],
    '5_missingLastScrapedAt': [],
    '7_createdAtAnomaly': [],
    '8_soldAtButActive': [],
    '9_pendingOver60': [],
    '10_isActiveUnusualValue': [],
  };

  const homeStatusFreq: Record<string, number> = {};
  const isActiveFreq: Record<string, number> = {};
  const activeByStatus: Record<string, number> = {};
  let total = 0;
  let activeTrue = 0;
  let activeFalse = 0;
  let activeNeither = 0;

  const SOLD_STATUSES = new Set(['SOLD', 'RECENTLY_SOLD', 'RECENT_SALE', 'OFF_MARKET']);

  for (const d of docs) {
    total++;
    const id = docId(d);
    const isActive = d.isActive;
    const hs = d.homeStatus;

    const hsKey = hs === undefined ? '__undefined__' : hs === null ? '__null__' : String(hs);
    homeStatusFreq[hsKey] = (homeStatusFreq[hsKey] || 0) + 1;

    const iaKey =
      isActive === true
        ? 'true'
        : isActive === false
          ? 'false'
          : isActive === null
            ? 'null'
            : isActive === undefined
              ? 'undefined'
              : `other:${typeof isActive}:${String(isActive)}`;
    isActiveFreq[iaKey] = (isActiveFreq[iaKey] || 0) + 1;

    if (isActive === true) activeTrue++;
    else if (isActive === false) activeFalse++;
    else activeNeither++;

    // Flag unusual isActive values
    if (isActive !== true && isActive !== false) {
      cat['10_isActiveUnusualValue'].push(id);
    }

    if (isActive === true) {
      activeByStatus[hsKey] = (activeByStatus[hsKey] || 0) + 1;
    }

    // 1: active but sold/off-market
    if (isActive === true && typeof hs === 'string' && SOLD_STATUSES.has(hs.toUpperCase())) {
      cat['1_activeButSold'].push(id);
    }

    // 2: active but deletedAt set
    if (isActive === true && d.deletedAt) {
      cat['2_activeButDeleted'].push(id);
    }

    // lastScrapedAt checks (only for docs that are NOT explicitly inactive)
    const lastScraped = parseDate(d.lastScrapedAt);
    if (isActive !== false) {
      if (lastScraped == null) {
        cat['5_missingLastScrapedAt'].push(id);
      } else {
        const age = NOW - lastScraped;
        if (age > D90) cat['4_staleOver90'].push(id);
        else if (age > D30) cat['3_staleOver30'].push(id);
      }
    }

    // 7: createdAt anomaly
    const createdAt = parseDate(d.createdAt);
    if (createdAt != null) {
      const cutoff2023 = Date.parse('2023-01-01T00:00:00Z');
      if (createdAt > NOW + DAY || createdAt < cutoff2023) {
        cat['7_createdAtAnomaly'].push(id);
      }
    }

    // 8: soldAt set but isActive === true
    if (isActive === true && d.soldAt) {
      cat['8_soldAtButActive'].push(id);
    }

    // 9: PENDING > 60 days old (use lastStatusCheck or lastScrapedAt or createdAt)
    if (typeof hs === 'string' && hs.toUpperCase() === 'PENDING') {
      const ref =
        parseDate(d.lastStatusCheck) ??
        parseDate(d.lastScrapedAt) ??
        parseDate(d.updatedAt) ??
        createdAt;
      if (ref != null && NOW - ref > D60) {
        cat['9_pendingOver60'].push(id);
      }
    }
  }

  // Sort homeStatus freq desc
  const sortedStatus = Object.entries(homeStatusFreq).sort((a, b) => b[1] - a[1]);
  const sortedActiveByStatus = Object.entries(activeByStatus).sort((a, b) => b[1] - a[1]);
  const sortedIsActive = Object.entries(isActiveFreq).sort((a, b) => b[1] - a[1]);

  const report = {
    generatedAt: new Date().toISOString(),
    currentDate: '2026-04-16',
    totalDocs: total,
    isActiveDistribution: {
      true: activeTrue,
      false: activeFalse,
      neither: activeNeither,
      breakdown: Object.fromEntries(sortedIsActive),
    },
    homeStatusFrequency: Object.fromEntries(sortedStatus),
    activeTrueByHomeStatus: Object.fromEntries(sortedActiveByStatus),
    categories: Object.fromEntries(
      Object.entries(cat).map(([k, v]) => [
        k,
        { count: v.length, first20: v.slice(0, 20) },
      ]),
    ),
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  console.log('Wrote', OUT_JSON);

  // Markdown
  const md: string[] = [];
  md.push('# Audit 09 — Lifecycle / Active Status');
  md.push('');
  md.push(`Generated: ${report.generatedAt}`);
  md.push(`Reference date: ${report.currentDate}`);
  md.push('');
  md.push('## Totals');
  md.push(`- Total docs: **${total}**`);
  md.push(`- isActive === true: **${activeTrue}**`);
  md.push(`- isActive === false: **${activeFalse}**`);
  md.push(`- isActive neither (null/undefined/other): **${activeNeither}**`);
  md.push('');
  md.push('## isActive distribution');
  md.push('');
  md.push('| value | count |');
  md.push('|---|---|');
  for (const [k, v] of sortedIsActive) md.push(`| ${k} | ${v} |`);
  md.push('');
  md.push('## homeStatus frequency');
  md.push('');
  md.push('| homeStatus | count |');
  md.push('|---|---|');
  for (const [k, v] of sortedStatus) md.push(`| ${k} | ${v} |`);
  md.push('');
  md.push('## isActive === true by homeStatus');
  md.push('');
  md.push('| homeStatus | count |');
  md.push('|---|---|');
  for (const [k, v] of sortedActiveByStatus) md.push(`| ${k} | ${v} |`);
  md.push('');
  md.push('## Issue categories');
  md.push('');
  const labels: Record<string, string> = {
    '1_activeButSold': '1. isActive=true but homeStatus in {SOLD,RECENTLY_SOLD,RECENT_SALE,OFF_MARKET}',
    '2_activeButDeleted': '2. isActive=true but deletedAt is set',
    '3_staleOver30': '3. isActive!=false but lastScrapedAt > 30d (and <=90d)',
    '4_staleOver90': '4. isActive!=false but lastScrapedAt > 90d',
    '5_missingLastScrapedAt': '5. isActive!=false but lastScrapedAt missing',
    '7_createdAtAnomaly': '7. createdAt in future or before 2023',
    '8_soldAtButActive': '8. soldAt set but isActive=true',
    '9_pendingOver60': '9. homeStatus=PENDING older than 60d',
    '10_isActiveUnusualValue': '10. isActive is not strictly true/false',
  };
  for (const key of Object.keys(cat)) {
    const c = cat[key];
    md.push(`### ${labels[key]}`);
    md.push(`- Count: **${c.length}**`);
    if (c.length > 0) {
      md.push('- First 20 IDs:');
      for (const id of c.slice(0, 20)) md.push(`  - \`${id}\``);
    }
    md.push('');
  }

  fs.writeFileSync(OUT_MD, md.join('\n'));
  console.log('Wrote', OUT_MD);

  // Console summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${total}  active:${activeTrue}  inactive:${activeFalse}  neither:${activeNeither}`);
  for (const [k, v] of Object.entries(cat)) {
    console.log(`${k}: ${v.length}`);
  }
}

main();
