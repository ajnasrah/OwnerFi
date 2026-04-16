/**
 * Audit Agent #5 — GEO / ADDRESS CONSISTENCY
 * Read-only audit of Firestore `properties` dump.
 *
 * Run: npx tsx scripts/_audit-05-geo.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const INPUT = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const OUT_JSON = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/05-geo.json';
const OUT_MD = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/05-geo.md';

// Rough US ZIP prefix ranges by state (first 1-2 digits).
// Only flag CLEAR mismatches when ZIP doesn't fall in any valid bucket.
const STATE_ZIP_PREFIXES: Record<string, RegExp> = {
  AL: /^(35|36)/,
  AK: /^(99[5-9])/,
  AZ: /^(85|86)/,
  AR: /^(71[6-9]|72)/,
  CA: /^(9[0-6])/,
  CO: /^(80|81)/,
  CT: /^(06)/,
  DE: /^(19[7-9])/,
  DC: /^(20[0-5]|569)/,
  FL: /^(32|33|34)/,
  GA: /^(30|31|398|399)/,
  HI: /^(967|968)/,
  ID: /^(83[2-9])/,
  IL: /^(60|61|62)/,
  IN: /^(46|47)/,
  IA: /^(5[0-2])/,
  KS: /^(6[6-7])/,
  KY: /^(4[0-2])/,
  LA: /^(70|71[0-5])/,
  ME: /^(039|04)/,
  MD: /^(20[6-9]|21)/,
  MA: /^(01|02[0-7])/,
  MI: /^(4[89])/,
  MN: /^(55|56[0-7])/,
  MS: /^(38[6-9]|39)/,
  MO: /^(6[3-5])/,
  MT: /^(59)/,
  NE: /^(68|69[0-3])/,
  NV: /^(889|89)/,
  NH: /^(03[0-8])/,
  NJ: /^(07|08)/,
  NM: /^(87|88[0-4])/,
  NY: /^(00[56]|1[0-4])/,
  NC: /^(2[78])/,
  ND: /^(58)/,
  OH: /^(4[3-5])/,
  OK: /^(73|74)/,
  OR: /^(97)/,
  PA: /^(1[5-9])/,
  PR: /^(006|007|009)/,
  RI: /^(02[89])/,
  SC: /^(29)/,
  SD: /^(57)/,
  TN: /^(37|38[0-5])/,
  TX: /^(75|76|77|78|79|885)/,
  UT: /^(84)/,
  VT: /^(05)/,
  VA: /^(201|22|23|24)/,
  WA: /^(98|99[0-4])/,
  WV: /^(24[7-9]|25|26[0-8])/,
  WI: /^(53|54)/,
  WY: /^(82|83[01])/,
};

interface Cat {
  name: string;
  desc: string;
  ids: string[];
  samples: any[];
}

const categories: Record<string, Cat> = {
  stateMalformed:      { name: 'stateMalformed',      desc: 'state present but not exactly 2 uppercase letters', ids: [], samples: [] },
  zipMalformed:        { name: 'zipMalformed',        desc: 'zipCode not exactly 5 digits (or valid ZIP+4)', ids: [], samples: [] },
  zipStateMismatch:    { name: 'zipStateMismatch',    desc: 'zipCode first digits clearly not in state range', ids: [], samples: [] },
  coordsOutOfBounds:   { name: 'coordsOutOfBounds',   desc: 'lat/lng both present but (0,0) or outside US bounds', ids: [], samples: [] },
  coordsOneMissing:    { name: 'coordsOneMissing',    desc: 'one of lat/lng present, the other missing', ids: [], samples: [] },
  fullAddressMissingState: { name: 'fullAddressMissingState', desc: 'fullAddress does not contain state code', ids: [], samples: [] },
  streetAddressMismatch:   { name: 'streetAddressMismatch',   desc: 'streetAddress and address both present but differ', ids: [], samples: [] },
  cityCasing:          { name: 'cityCasing',          desc: 'city is all lowercase or ALL CAPS', ids: [], samples: [] },
  addressHasComma:     { name: 'addressHasComma',     desc: 'address contains a comma (likely full string jammed in)', ids: [], samples: [] },
  duplicateCoords:     { name: 'duplicateCoords',     desc: 'same lat/lng (4dp) appears in >5 docs', ids: [], samples: [] },
};

function pushCat(catKey: string, id: string, sample: any) {
  const c = categories[catKey];
  c.ids.push(id);
  if (c.samples.length < 20) c.samples.push(sample);
}

function isStrNonEmpty(v: any): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

const raw = fs.readFileSync(INPUT, 'utf8');
const parsed = JSON.parse(raw);
const docs: any[] = Array.isArray(parsed) ? parsed : (parsed.docs || parsed.properties || Object.values(parsed));

console.log(`Loaded ${docs.length} documents`);

// Pass 1: per-doc checks & coord bucket tally
const coordBuckets: Record<string, string[]> = {};

for (const d of docs) {
  const id: string = d.id || d._id || d.docId || d.propertyId || 'UNKNOWN';

  const state = d.state;
  const zip = d.zipCode;
  const addr = d.address;
  const street = d.streetAddress;
  const full = d.fullAddress;
  const city = d.city;
  const lat = d.latitude;
  const lng = d.longitude;

  // 1. state malformed
  if (state !== undefined && state !== null && state !== '') {
    if (typeof state !== 'string' || !/^[A-Z]{2}$/.test(state)) {
      pushCat('stateMalformed', id, { id, state });
    }
  }

  // 2. zip malformed
  let zipCore: string | null = null;
  if (zip !== undefined && zip !== null && zip !== '') {
    const s = String(zip).trim();
    if (/^\d{5}$/.test(s)) {
      zipCore = s;
    } else if (/^\d{5}-\d{4}$/.test(s)) {
      zipCore = s.slice(0, 5);
    } else {
      pushCat('zipMalformed', id, { id, zipCode: zip });
    }
  }

  // 3. zip/state mismatch
  if (zipCore && typeof state === 'string' && /^[A-Z]{2}$/.test(state)) {
    const re = STATE_ZIP_PREFIXES[state];
    if (re && !re.test(zipCore)) {
      pushCat('zipStateMismatch', id, { id, state, zipCode: zipCore });
    }
  }

  // 4. coords out of bounds
  const hasLat = typeof lat === 'number' && !Number.isNaN(lat);
  const hasLng = typeof lng === 'number' && !Number.isNaN(lng);
  if (hasLat && hasLng) {
    if (lat === 0 && lng === 0) {
      pushCat('coordsOutOfBounds', id, { id, lat, lng, reason: 'zero' });
    } else if (lat < 24 || lat > 50 || lng < -125 || lng > -66) {
      // Allow Alaska (AK) and Hawaii (HI) — skip if state is AK/HI
      if (state !== 'AK' && state !== 'HI' && state !== 'PR') {
        pushCat('coordsOutOfBounds', id, { id, lat, lng, state });
      }
    }
  }

  // 5. one missing
  if (hasLat !== hasLng) {
    // Also treat nullish mismatch as missing pair
    const latPresent = lat !== undefined && lat !== null && lat !== '';
    const lngPresent = lng !== undefined && lng !== null && lng !== '';
    if (latPresent !== lngPresent) {
      pushCat('coordsOneMissing', id, { id, latitude: lat, longitude: lng });
    }
  } else {
    // also handle string-typed lat/lng edge: consider presence as truthy
    const latPresent = lat !== undefined && lat !== null && lat !== '';
    const lngPresent = lng !== undefined && lng !== null && lng !== '';
    if (latPresent !== lngPresent) {
      pushCat('coordsOneMissing', id, { id, latitude: lat, longitude: lng });
    }
  }

  // 6. fullAddress missing state
  if (isStrNonEmpty(full) && typeof state === 'string' && /^[A-Z]{2}$/.test(state)) {
    // check case-insensitively for state code as standalone token
    const re = new RegExp(`\\b${state}\\b`, 'i');
    if (!re.test(full)) {
      pushCat('fullAddressMissingState', id, { id, fullAddress: full, state });
    }
  }

  // 7. streetAddress vs address differ
  if (isStrNonEmpty(street) && isStrNonEmpty(addr)) {
    if (street.trim() !== addr.trim()) {
      pushCat('streetAddressMismatch', id, { id, streetAddress: street, address: addr });
    }
  }

  // 8. city casing
  if (isStrNonEmpty(city)) {
    const hasLetter = /[A-Za-z]/.test(city);
    if (hasLetter) {
      if (city === city.toLowerCase() || city === city.toUpperCase()) {
        pushCat('cityCasing', id, { id, city });
      }
    }
  }

  // 9. address has comma
  if (isStrNonEmpty(addr) && addr.includes(',')) {
    pushCat('addressHasComma', id, { id, address: addr });
  }

  // coord bucket for dup detection
  if (hasLat && hasLng && !(lat === 0 && lng === 0)) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (!coordBuckets[key]) coordBuckets[key] = [];
    coordBuckets[key].push(id);
  }
}

// 10. duplicate coords (>5 docs sharing)
const dupGroups: { coord: string; count: number; ids: string[] }[] = [];
for (const [key, ids] of Object.entries(coordBuckets)) {
  if (ids.length > 5) {
    dupGroups.push({ coord: key, count: ids.length, ids });
    for (const id of ids) {
      categories.duplicateCoords.ids.push(id);
      if (categories.duplicateCoords.samples.length < 20) {
        categories.duplicateCoords.samples.push({ id, coord: key, groupSize: ids.length });
      }
    }
  }
}
dupGroups.sort((a, b) => b.count - a.count);

// Report
const report: any = {
  totalDocs: docs.length,
  generatedAt: new Date().toISOString(),
  categories: {} as Record<string, any>,
  duplicateCoordGroups: dupGroups.slice(0, 20),
};

for (const [key, c] of Object.entries(categories)) {
  report.categories[key] = {
    description: c.desc,
    count: c.ids.length,
    first20Ids: c.ids.slice(0, 20),
    samples: c.samples,
  };
}

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(`Wrote ${OUT_JSON}`);

// Markdown
const lines: string[] = [];
lines.push(`# Audit 05 — GEO / Address Consistency`);
lines.push('');
lines.push(`- Total docs: **${docs.length}**`);
lines.push(`- Generated: ${report.generatedAt}`);
lines.push('');
lines.push(`## Category Counts`);
lines.push('');
lines.push(`| Category | Count | Description |`);
lines.push(`|---|---:|---|`);
for (const [key, c] of Object.entries(categories)) {
  lines.push(`| \`${key}\` | ${c.ids.length} | ${c.desc} |`);
}
lines.push('');
for (const [key, c] of Object.entries(categories)) {
  lines.push(`## ${key} (${c.ids.length})`);
  lines.push('');
  lines.push(c.desc);
  lines.push('');
  if (c.ids.length === 0) { lines.push('_None_'); lines.push(''); continue; }
  lines.push('First 20 doc IDs:');
  lines.push('');
  for (const id of c.ids.slice(0, 20)) lines.push(`- \`${id}\``);
  lines.push('');
  if (c.samples.length) {
    lines.push('Samples:');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(c.samples.slice(0, 10), null, 2));
    lines.push('```');
    lines.push('');
  }
}
if (dupGroups.length) {
  lines.push(`## Top Duplicate Coord Groups`);
  lines.push('');
  lines.push('| Coord (lat,lng) | Docs |');
  lines.push('|---|---:|');
  for (const g of dupGroups.slice(0, 20)) {
    lines.push(`| ${g.coord} | ${g.count} |`);
  }
  lines.push('');
}

fs.writeFileSync(OUT_MD, lines.join('\n'));
console.log(`Wrote ${OUT_MD}`);

// Console summary
console.log('\n=== SUMMARY ===');
for (const [key, c] of Object.entries(categories)) {
  console.log(`${key.padEnd(28)} ${c.ids.length}`);
}
console.log(`duplicateCoordGroups       ${dupGroups.length} (groups with >5 docs)`);
