/**
 * Audit #01 — Duplicates in Firestore `properties` collection.
 * READ-ONLY. Reads dump JSON, writes structured + markdown findings.
 *
 * Usage: npx tsx scripts/_audit-01-dupes.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const OUT_JSON = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/01-duplicates.json';
const OUT_MD = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/01-duplicates.md';

type Prop = {
  id: string;
  zpid?: string | number;
  address?: string;
  streetAddress?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string | number;
  latitude?: number;
  longitude?: number;
  price?: number;
  dealTypes?: string[];
  isActive?: boolean;
  url?: string;
  hdpUrl?: string;
  source?: string;
  createdAt?: any;
  lastScrapedAt?: any;
  [key: string]: any;
};

function normalizeZpid(z: any): string | null {
  if (z === null || z === undefined || z === '') return null;
  const s = String(z).trim();
  if (!s) return null;
  // Strip non-digits (defensive)
  const digits = s.replace(/[^0-9]/g, '');
  return digits || null;
}

function normalizeAddress(p: Prop): string | null {
  const parts: string[] = [];
  const street = p.fullAddress || p.address || p.streetAddress;
  if (street) parts.push(String(street));
  if (p.city) parts.push(String(p.city));
  if (p.state) parts.push(String(p.state));
  if (p.zipCode) parts.push(String(p.zipCode));
  if (!parts.length) return null;
  const joined = parts.join(' ');
  const norm = joined
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return norm || null;
}

function roundLatLng(lat: any, lng: any): string | null {
  const la = typeof lat === 'number' ? lat : parseFloat(lat);
  const ln = typeof lng === 'number' ? lng : parseFloat(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  // exclude obvious null-island / 0,0
  if (la === 0 && ln === 0) return null;
  return `${la.toFixed(5)},${ln.toFixed(5)}`;
}

function normUrl(u: any): string | null {
  if (!u) return null;
  const s = String(u).trim().toLowerCase();
  if (!s) return null;
  // strip trailing slash, query
  return s.replace(/\?.*$/, '').replace(/\/$/, '');
}

function ts(x: any): string {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'number') return new Date(x).toISOString();
  if (x._seconds) return new Date(x._seconds * 1000).toISOString();
  if (x.seconds) return new Date(x.seconds * 1000).toISOString();
  return JSON.stringify(x);
}

console.log('Reading', INPUT);
const raw = fs.readFileSync(INPUT, 'utf8');
const docs: Prop[] = JSON.parse(raw);
console.log(`Loaded ${docs.length} property docs`);

// Indexes
const byZpid = new Map<string, Prop[]>();
const byDocId = new Map<string, Prop[]>();
const byAddress = new Map<string, Prop[]>();
const byLatLng = new Map<string, Prop[]>();
const byUrl = new Map<string, Prop[]>();
const byHdpUrl = new Map<string, Prop[]>();
const sourceCounts = new Map<string, number>();
const sourceCountsDupes = new Map<string, number>();

for (const d of docs) {
  // source distribution
  const src = d.source || '(missing)';
  sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);

  const z = normalizeZpid(d.zpid);
  if (z) {
    if (!byZpid.has(z)) byZpid.set(z, []);
    byZpid.get(z)!.push(d);
  }

  if (d.id) {
    if (!byDocId.has(d.id)) byDocId.set(d.id, []);
    byDocId.get(d.id)!.push(d);
  }

  const addr = normalizeAddress(d);
  if (addr && addr.length > 6) {
    if (!byAddress.has(addr)) byAddress.set(addr, []);
    byAddress.get(addr)!.push(d);
  }

  const ll = roundLatLng(d.latitude, d.longitude);
  if (ll) {
    if (!byLatLng.has(ll)) byLatLng.set(ll, []);
    byLatLng.get(ll)!.push(d);
  }

  const u = normUrl(d.url);
  if (u) {
    if (!byUrl.has(u)) byUrl.set(u, []);
    byUrl.get(u)!.push(d);
  }
  const hu = normUrl(d.hdpUrl);
  if (hu) {
    if (!byHdpUrl.has(hu)) byHdpUrl.set(hu, []);
    byHdpUrl.get(hu)!.push(d);
  }
}

// 1. Same zpid, multiple docs
type DupeGroup = {
  key: string;
  count: number;
  docs: Array<{
    id: string;
    zpid?: string | number;
    normalizedZpid?: string | null;
    fullAddress?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: any;
    latitude?: number;
    longitude?: number;
    price?: number;
    source?: string;
    isActive?: boolean;
    url?: string;
    hdpUrl?: string;
    createdAt?: string;
    lastScrapedAt?: string;
  }>;
};

function compactDoc(d: Prop): DupeGroup['docs'][number] {
  return {
    id: d.id,
    zpid: d.zpid,
    normalizedZpid: normalizeZpid(d.zpid),
    fullAddress: d.fullAddress,
    address: d.address,
    city: d.city,
    state: d.state,
    zipCode: d.zipCode,
    latitude: d.latitude,
    longitude: d.longitude,
    price: d.price,
    source: d.source,
    isActive: d.isActive,
    url: d.url,
    hdpUrl: d.hdpUrl,
    createdAt: ts(d.createdAt),
    lastScrapedAt: ts(d.lastScrapedAt),
  };
}

const sameZpid: DupeGroup[] = [];
for (const [z, arr] of byZpid) {
  if (arr.length > 1) {
    sameZpid.push({ key: z, count: arr.length, docs: arr.map(compactDoc) });
    for (const d of arr) {
      const src = d.source || '(missing)';
      sourceCountsDupes.set(src, (sourceCountsDupes.get(src) || 0) + 1);
    }
  }
}
sameZpid.sort((a, b) => b.count - a.count);

const sameDocId: DupeGroup[] = [];
for (const [id, arr] of byDocId) {
  if (arr.length > 1) {
    sameDocId.push({ key: id, count: arr.length, docs: arr.map(compactDoc) });
  }
}
sameDocId.sort((a, b) => b.count - a.count);

// 3. Same address, DIFFERENT zpids
const sameAddrDiffZpid: DupeGroup[] = [];
for (const [addr, arr] of byAddress) {
  if (arr.length < 2) continue;
  const zpids = new Set<string>();
  for (const d of arr) {
    const z = normalizeZpid(d.zpid);
    if (z) zpids.add(z);
    else zpids.add(`no-zpid:${d.id}`);
  }
  if (zpids.size > 1) {
    sameAddrDiffZpid.push({ key: addr, count: arr.length, docs: arr.map(compactDoc) });
  }
}
sameAddrDiffZpid.sort((a, b) => b.count - a.count);

// 4. Same lat/lng rounded, DIFFERENT zpids
const sameLatLngDiffZpid: DupeGroup[] = [];
for (const [ll, arr] of byLatLng) {
  if (arr.length < 2) continue;
  const zpids = new Set<string>();
  for (const d of arr) {
    const z = normalizeZpid(d.zpid);
    if (z) zpids.add(z);
    else zpids.add(`no-zpid:${d.id}`);
  }
  if (zpids.size > 1) {
    sameLatLngDiffZpid.push({ key: ll, count: arr.length, docs: arr.map(compactDoc) });
  }
}
sameLatLngDiffZpid.sort((a, b) => b.count - a.count);

// 5. Same URL / hdpUrl multiple docs
const sameUrl: DupeGroup[] = [];
for (const [u, arr] of byUrl) {
  if (arr.length > 1) {
    sameUrl.push({ key: u, count: arr.length, docs: arr.map(compactDoc) });
  }
}
sameUrl.sort((a, b) => b.count - a.count);

const sameHdpUrl: DupeGroup[] = [];
for (const [u, arr] of byHdpUrl) {
  if (arr.length > 1) {
    sameHdpUrl.push({ key: u, count: arr.length, docs: arr.map(compactDoc) });
  }
}
sameHdpUrl.sort((a, b) => b.count - a.count);

// Source distribution (full)
const sourceDist: Array<{ source: string; count: number }> = [];
for (const [s, c] of sourceCounts) sourceDist.push({ source: s, count: c });
sourceDist.sort((a, b) => b.count - a.count);

const sourceDupesDist: Array<{ source: string; count: number }> = [];
for (const [s, c] of sourceCountsDupes) sourceDupesDist.push({ source: s, count: c });
sourceDupesDist.sort((a, b) => b.count - a.count);

const summary = {
  inputDocCount: docs.length,
  uniqueZpids: byZpid.size,
  docsWithoutZpid: docs.filter(d => !normalizeZpid(d.zpid)).length,
  counts: {
    sameZpidGroups: sameZpid.length,
    sameZpidAffectedDocs: sameZpid.reduce((a, g) => a + g.count, 0),
    sameDocIdGroups: sameDocId.length,
    sameAddressDiffZpidGroups: sameAddrDiffZpid.length,
    sameAddressDiffZpidAffectedDocs: sameAddrDiffZpid.reduce((a, g) => a + g.count, 0),
    sameLatLngDiffZpidGroups: sameLatLngDiffZpid.length,
    sameLatLngDiffZpidAffectedDocs: sameLatLngDiffZpid.reduce((a, g) => a + g.count, 0),
    sameUrlGroups: sameUrl.length,
    sameHdpUrlGroups: sameHdpUrl.length,
  },
  sourceDistribution: sourceDist,
  sourceDistributionOfZpidDupes: sourceDupesDist,
};

const out = {
  summary,
  sameZpid,
  sameDocId,
  sameAddressDiffZpid: sameAddrDiffZpid,
  sameLatLngDiffZpid,
  sameUrl,
  sameHdpUrl,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
console.log('Wrote', OUT_JSON);

// Markdown summary
const lines: string[] = [];
lines.push(`# Audit #01 — Duplicates`);
lines.push('');
lines.push(`**Input:** \`${INPUT}\``);
lines.push(`**Docs analyzed:** ${docs.length}`);
lines.push(`**Unique zpids:** ${byZpid.size}`);
lines.push(`**Docs without usable zpid:** ${summary.docsWithoutZpid}`);
lines.push('');
lines.push('## Counts');
lines.push('');
lines.push('| Category | Groups | Affected Docs |');
lines.push('|---|---:|---:|');
lines.push(`| Same normalized zpid, >1 doc | ${summary.counts.sameZpidGroups} | ${summary.counts.sameZpidAffectedDocs} |`);
lines.push(`| Same Firestore doc ID (should be 0) | ${summary.counts.sameDocIdGroups} | — |`);
lines.push(`| Same address, DIFFERENT zpids | ${summary.counts.sameAddressDiffZpidGroups} | ${summary.counts.sameAddressDiffZpidAffectedDocs} |`);
lines.push(`| Same lat/lng (5dp), DIFFERENT zpids | ${summary.counts.sameLatLngDiffZpidGroups} | ${summary.counts.sameLatLngDiffZpidAffectedDocs} |`);
lines.push(`| Same \`url\` across multiple docs | ${summary.counts.sameUrlGroups} | — |`);
lines.push(`| Same \`hdpUrl\` across multiple docs | ${summary.counts.sameHdpUrlGroups} | — |`);
lines.push('');
lines.push('## Source distribution (all docs)');
lines.push('');
lines.push('| Source | Count |');
lines.push('|---|---:|');
for (const s of sourceDist) lines.push(`| ${s.source} | ${s.count} |`);
lines.push('');
lines.push('## Source distribution (docs in same-zpid dupe groups)');
lines.push('');
lines.push('| Source | Count |');
lines.push('|---|---:|');
for (const s of sourceDupesDist) lines.push(`| ${s.source} | ${s.count} |`);
lines.push('');

function renderTopGroups(title: string, arr: DupeGroup[], limit = 20) {
  lines.push(`## Top ${limit} — ${title}`);
  lines.push('');
  if (!arr.length) {
    lines.push('_None found._');
    lines.push('');
    return;
  }
  for (let i = 0; i < Math.min(limit, arr.length); i++) {
    const g = arr[i];
    lines.push(`### ${i + 1}. key = \`${g.key}\`  (count=${g.count})`);
    lines.push('');
    lines.push('| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |');
    lines.push('|---|---|---|---|---:|---|---|---|');
    for (const d of g.docs) {
      const cs = `${d.city || '?'}, ${d.state || '?'} ${d.zipCode || ''}`.trim();
      lines.push(
        `| \`${d.id}\` | ${d.zpid ?? ''} | ${d.source ?? ''} | ${d.isActive ?? ''} | ${d.price ?? ''} | ${cs} | ${d.createdAt ?? ''} | ${d.lastScrapedAt ?? ''} |`
      );
    }
    lines.push('');
  }
}

renderTopGroups('Same zpid, multiple docs', sameZpid, 20);
renderTopGroups('Same Firestore doc ID (should be zero)', sameDocId, 20);
renderTopGroups('Same normalized address, DIFFERENT zpids (most dangerous)', sameAddrDiffZpid, 20);
renderTopGroups('Same lat/lng (5dp), DIFFERENT zpids', sameLatLngDiffZpid, 20);
renderTopGroups('Same `url`', sameUrl, 20);
renderTopGroups('Same `hdpUrl`', sameHdpUrl, 20);

fs.writeFileSync(OUT_MD, lines.join('\n'));
console.log('Wrote', OUT_MD);

// Console-friendly top-5 summary for the audit report-back
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary.counts, null, 2));
console.log('\nTop 5 same-zpid offenders:');
for (const g of sameZpid.slice(0, 5)) {
  console.log(`  zpid=${g.key} count=${g.count} ids=${g.docs.map(d => d.id).join(',')}`);
}
console.log('\nTop 5 same-address-diff-zpid offenders:');
for (const g of sameAddrDiffZpid.slice(0, 5)) {
  console.log(`  addr="${g.key.slice(0, 80)}" count=${g.count} ids=${g.docs.map(d => d.id).join(',')}`);
}
console.log('\nTop 5 same-latlng-diff-zpid offenders:');
for (const g of sameLatLngDiffZpid.slice(0, 5)) {
  console.log(`  ll=${g.key} count=${g.count} ids=${g.docs.map(d => d.id).join(',')}`);
}
console.log('\nTop 5 same-url offenders:');
for (const g of sameUrl.slice(0, 5)) {
  console.log(`  url=${g.key.slice(0, 80)} count=${g.count} ids=${g.docs.map(d => d.id).join(',')}`);
}
console.log('\nTop 5 same-hdpUrl offenders:');
for (const g of sameHdpUrl.slice(0, 5)) {
  console.log(`  hdp=${g.key.slice(0, 80)} count=${g.count} ids=${g.docs.map(d => d.id).join(',')}`);
}
