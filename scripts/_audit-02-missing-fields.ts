/**
 * Audit Agent #2 — Critical Field Completeness
 * READ-ONLY. Reads dump-properties.json, groups missing fields by `source`.
 */

import * as fs from 'fs';
import * as path from 'path';

type Doc = Record<string, any>;

const DUMP_PATH = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const OUT_DIR = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports';
const JSON_OUT = path.join(OUT_DIR, '02-missing-fields.json');
const MD_OUT = path.join(OUT_DIR, '02-missing-fields.md');

const INACTIVE_STATUSES = new Set(['SOLD', 'RECENTLY_SOLD', 'OFF_MARKET', 'RECENT_SALE']);

const FIELD_KEYS = [
  'address_or_streetAddress',
  'city',
  'state',
  'zipCode',
  'price',
  'latlng',
  'url_or_hdpUrl',
  'homeType',
  'zpid',
  'dealTypes',
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

function isBlank(v: any): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function missingChecks(d: Doc): FieldKey[] {
  const missing: FieldKey[] = [];

  // 1) address OR streetAddress
  if (isBlank(d.address) && isBlank(d.streetAddress) && isBlank(d.fullAddress)) {
    missing.push('address_or_streetAddress');
  }

  // 2) city
  if (isBlank(d.city)) missing.push('city');

  // 3) state — 2 uppercase letters
  const st = typeof d.state === 'string' ? d.state.trim() : '';
  if (!/^[A-Z]{2}$/.test(st)) missing.push('state');

  // 4) zip — 5 digits (strip ZIP+4)
  const zRaw = d.zipCode ?? d.zip ?? '';
  const zStr = typeof zRaw === 'number' ? String(zRaw).padStart(5, '0') : String(zRaw || '').trim();
  const zBase = zStr.split('-')[0];
  if (!/^\d{5}$/.test(zBase)) missing.push('zipCode');

  // 5) price
  const price = typeof d.price === 'number' ? d.price : (typeof d.listPrice === 'number' ? d.listPrice : null);
  if (price === null || !(price > 0)) missing.push('price');

  // 6) latitude + longitude (both present, not 0,0)
  const lat = d.latitude;
  const lng = d.longitude;
  const latOk = typeof lat === 'number' && !Number.isNaN(lat);
  const lngOk = typeof lng === 'number' && !Number.isNaN(lng);
  if (!latOk || !lngOk || (lat === 0 && lng === 0)) missing.push('latlng');

  // 7) url OR hdpUrl
  if (isBlank(d.url) && isBlank(d.hdpUrl)) missing.push('url_or_hdpUrl');

  // 8) homeType
  if (isBlank(d.homeType)) missing.push('homeType');

  // 9) zpid
  if (isBlank(d.zpid)) missing.push('zpid');

  // 10) dealTypes must be array
  if (!Array.isArray(d.dealTypes)) missing.push('dealTypes');

  return missing;
}

function main() {
  console.log('[audit-02] reading', DUMP_PATH);
  const raw = fs.readFileSync(DUMP_PATH, 'utf8');
  const docs: Doc[] = JSON.parse(raw);
  console.log(`[audit-02] total docs: ${docs.length}`);

  const active = docs.filter((d) => d.isActive !== false);
  console.log(`[audit-02] active docs: ${active.length}`);

  // counts per field
  const fieldCounts: Record<FieldKey, number> = {
    address_or_streetAddress: 0,
    city: 0,
    state: 0,
    zipCode: 0,
    price: 0,
    latlng: 0,
    url_or_hdpUrl: 0,
    homeType: 0,
    zpid: 0,
    dealTypes: 0,
  };

  // per-source breakdown
  const bySource: Record<string, {
    total: number;
    missingAny: number;
    perField: Record<FieldKey, number>;
    sampleIds: Record<FieldKey, string[]>;
  }> = {};

  function ensureSource(src: string) {
    if (!bySource[src]) {
      bySource[src] = {
        total: 0,
        missingAny: 0,
        perField: {
          address_or_streetAddress: 0,
          city: 0,
          state: 0,
          zipCode: 0,
          price: 0,
          latlng: 0,
          url_or_hdpUrl: 0,
          homeType: 0,
          zpid: 0,
          dealTypes: 0,
        },
        sampleIds: {
          address_or_streetAddress: [],
          city: [],
          state: [],
          zipCode: [],
          price: [],
          latlng: [],
          url_or_hdpUrl: [],
          homeType: [],
          zpid: [],
          dealTypes: [],
        },
      };
    }
    return bySource[src];
  }

  // also flag active w/ terminal homeStatus
  const shouldBeInactive: { id: string; source: string; homeStatus: string; zpid?: string }[] = [];
  const shouldBeInactiveBySource: Record<string, number> = {};

  for (const d of active) {
    const src = typeof d.source === 'string' && d.source ? d.source : '(unknown)';
    const entry = ensureSource(src);
    entry.total += 1;

    const missing = missingChecks(d);
    if (missing.length) entry.missingAny += 1;
    for (const k of missing) {
      fieldCounts[k] += 1;
      entry.perField[k] += 1;
      if (entry.sampleIds[k].length < 5) {
        entry.sampleIds[k].push(String(d.id ?? d.zpid ?? '?'));
      }
    }

    const hs = typeof d.homeStatus === 'string' ? d.homeStatus.toUpperCase() : '';
    if (INACTIVE_STATUSES.has(hs)) {
      shouldBeInactive.push({
        id: String(d.id ?? d.zpid ?? '?'),
        source: src,
        homeStatus: hs,
        zpid: d.zpid,
      });
      shouldBeInactiveBySource[src] = (shouldBeInactiveBySource[src] || 0) + 1;
    }
  }

  // ordered sources by total desc
  const sourcesOrdered = Object.entries(bySource)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([k]) => k);

  // priority ranking (simple: highest global counts first)
  const priorityRanking = (Object.entries(fieldCounts) as [FieldKey, number][])
    .sort((a, b) => b[1] - a[1]);

  const report = {
    generatedAt: new Date().toISOString(),
    totalDocs: docs.length,
    activeDocs: active.length,
    inactiveDocs: docs.length - active.length,
    fieldCountsGlobal: fieldCounts,
    priorityRanking: priorityRanking.map(([field, count]) => ({ field, count })),
    sources: sourcesOrdered.map((src) => ({
      source: src,
      total: bySource[src].total,
      missingAnyCount: bySource[src].missingAny,
      missingAnyPct: +(100 * bySource[src].missingAny / Math.max(1, bySource[src].total)).toFixed(2),
      perField: bySource[src].perField,
      sampleIds: bySource[src].sampleIds,
    })),
    shouldBeInactive: {
      total: shouldBeInactive.length,
      bySource: shouldBeInactiveBySource,
      sample: shouldBeInactive.slice(0, 25),
    },
  };

  fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  console.log('[audit-02] wrote', JSON_OUT);

  // Markdown
  const lines: string[] = [];
  lines.push('# Audit 02 — Critical Field Completeness');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Total docs: ${report.totalDocs}`);
  lines.push(`- Active docs: ${report.activeDocs}`);
  lines.push(`- Inactive docs: ${report.inactiveDocs}`);
  lines.push('');
  lines.push('## Missing-field counts (active docs)');
  lines.push('');
  lines.push('| Field | Missing | % of active |');
  lines.push('|---|---:|---:|');
  for (const [field, count] of priorityRanking) {
    const pct = (100 * count / Math.max(1, active.length)).toFixed(2);
    lines.push(`| ${field} | ${count} | ${pct}% |`);
  }
  lines.push('');
  lines.push('## By source');
  lines.push('');
  lines.push('| Source | Active | Missing any | % | addr | city | state | zip | price | latlng | url | homeType | zpid | dealTypes |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const src of sourcesOrdered) {
    const s = bySource[src];
    const pct = (100 * s.missingAny / Math.max(1, s.total)).toFixed(1);
    lines.push(
      `| ${src} | ${s.total} | ${s.missingAny} | ${pct}% | ${s.perField.address_or_streetAddress} | ${s.perField.city} | ${s.perField.state} | ${s.perField.zipCode} | ${s.perField.price} | ${s.perField.latlng} | ${s.perField.url_or_hdpUrl} | ${s.perField.homeType} | ${s.perField.zpid} | ${s.perField.dealTypes} |`
    );
  }
  lines.push('');
  lines.push('## Active but terminal homeStatus (should be inactive)');
  lines.push('');
  lines.push(`Total: ${shouldBeInactive.length}`);
  lines.push('');
  lines.push('| Source | Count |');
  lines.push('|---|---:|');
  for (const [src, count] of Object.entries(shouldBeInactiveBySource).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${src} | ${count} |`);
  }
  lines.push('');
  lines.push('### Sample (up to 25)');
  lines.push('');
  lines.push('| id | source | homeStatus |');
  lines.push('|---|---|---|');
  for (const r of shouldBeInactive.slice(0, 25)) {
    lines.push(`| ${r.id} | ${r.source} | ${r.homeStatus} |`);
  }
  lines.push('');
  lines.push('## Top 3 priority gaps');
  lines.push('');
  priorityRanking.slice(0, 3).forEach(([f, c], i) => {
    lines.push(`${i + 1}. **${f}** — ${c} active docs missing`);
  });
  lines.push('');

  fs.writeFileSync(MD_OUT, lines.join('\n'));
  console.log('[audit-02] wrote', MD_OUT);

  // stdout summary
  console.log('\n=== SUMMARY ===');
  console.log('Active:', active.length);
  for (const [f, c] of priorityRanking) {
    console.log(`  ${f}: ${c}`);
  }
  console.log('shouldBeInactive:', shouldBeInactive.length);
}

main();
