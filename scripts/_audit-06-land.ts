#!/usr/bin/env npx tsx
/**
 * Audit #6: Land classification audit (READ-ONLY)
 */

import * as fs from 'fs';
import * as path from 'path';

const DUMP_PATH = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const OUT_JSON = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/06-land.json';
const OUT_MD = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/06-land.md';

const EXPECTED_HOMETYPES = new Set([
  'single-family',
  'land',
  'condo',
  'townhouse',
  'manufactured',
  'multi-family',
  'apartment',
  'other',
]);

interface Prop {
  id?: string;
  _id?: string;
  docId?: string;
  homeType?: any;
  rawHomeType?: any;
  isLand?: any;
  lotSquareFoot?: any;
  squareFoot?: any;
  bedrooms?: any;
  bathrooms?: any;
  dealTypes?: any;
  isActive?: any;
  zestimate?: any;
  zillowZestimate?: any;
  arv?: any;
}

function getId(p: Prop): string {
  return p.id || p._id || p.docId || '(no-id)';
}

function toNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function getZestimate(p: Prop): number {
  return toNum(p.zestimate) || toNum(p.zillowZestimate) || toNum(p.arv);
}

function main() {
  console.log('Loading dump...');
  const raw = fs.readFileSync(DUMP_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const props: Prop[] = Array.isArray(data) ? data : (data.properties || data.docs || Object.values(data));
  console.log(`Loaded ${props.length} properties`);

  // Frequency table of homeType
  const homeTypeCounts: Record<string, number> = {};
  const rawHomeTypeCounts: Record<string, number> = {};

  for (const p of props) {
    const ht = p.homeType === undefined || p.homeType === null ? '(missing)' : String(p.homeType);
    homeTypeCounts[ht] = (homeTypeCounts[ht] || 0) + 1;
    if (p.rawHomeType !== undefined) {
      const rht = p.rawHomeType === null ? '(null)' : String(p.rawHomeType);
      rawHomeTypeCounts[rht] = (rawHomeTypeCounts[rht] || 0) + 1;
    }
  }

  // Category 1: homeType says land/lot but isLand !== true
  const cat1: string[] = [];
  for (const p of props) {
    const htStr = p.homeType === undefined || p.homeType === null ? '' : String(p.homeType);
    const htLower = htStr.toLowerCase();
    const looksLand =
      htStr === 'LOT' ||
      htStr === 'VACANT_LAND' ||
      htStr === 'LAND' ||
      htStr === 'land' ||
      htLower.includes('land') ||
      htLower.includes('lot');
    if (looksLand && p.isLand !== true) {
      cat1.push(getId(p));
    }
  }

  // Category 2: isLand === true but homeType != 'land'
  const cat2: string[] = [];
  for (const p of props) {
    if (p.isLand === true) {
      const ht = p.homeType === undefined || p.homeType === null ? '' : String(p.homeType);
      if (ht !== 'land') cat2.push(getId(p));
    }
  }

  // Category 3: probable unflagged land
  const cat3: string[] = [];
  for (const p of props) {
    if (p.isLand === true) continue;
    const bd = toNum(p.bedrooms);
    const ba = toNum(p.bathrooms);
    const sf = toNum(p.squareFoot);
    const lsf = toNum(p.lotSquareFoot);
    if (bd === 0 && ba === 0 && sf === 0 && lsf > 0) {
      cat3.push(getId(p));
    }
  }

  // Category 5: homeType not in expected set
  const cat5: string[] = [];
  const cat5Values: Record<string, number> = {};
  for (const p of props) {
    if (p.homeType === undefined || p.homeType === null || p.homeType === '') continue;
    const ht = String(p.homeType);
    if (!EXPECTED_HOMETYPES.has(ht)) {
      cat5.push(getId(p));
      cat5Values[ht] = (cat5Values[ht] || 0) + 1;
    }
  }

  // Category 6: land in dealTypes: ['cash_deal']
  const cat6: string[] = [];
  for (const p of props) {
    if (p.isLand !== true) continue;
    const dt = p.dealTypes;
    if (Array.isArray(dt) && dt.includes('cash_deal')) {
      cat6.push(getId(p));
    }
  }

  // Category 7: land with non-zero zestimate
  const cat7: string[] = [];
  for (const p of props) {
    if (p.isLand !== true) continue;
    const z = getZestimate(p);
    if (z > 0) cat7.push(getId(p));
  }

  // Category 8: homeType missing but isActive
  const cat8: string[] = [];
  for (const p of props) {
    const htMissing = p.homeType === undefined || p.homeType === null || p.homeType === '';
    if (htMissing && p.isActive === true) cat8.push(getId(p));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalProperties: props.length,
    homeTypeFrequency: homeTypeCounts,
    rawHomeTypeFrequency: rawHomeTypeCounts,
    categories: {
      cat1_landHomeTypeButNotFlagged: {
        description: 'homeType says land/lot but isLand !== true',
        count: cat1.length,
        first20: cat1.slice(0, 20),
      },
      cat2_flaggedLandButWrongHomeType: {
        description: 'isLand === true but homeType !== "land"',
        count: cat2.length,
        first20: cat2.slice(0, 20),
      },
      cat3_probableUnflaggedLand: {
        description: 'bd=0 ba=0 sf=0 lsf>0 and isLand !== true',
        count: cat3.length,
        first20: cat3.slice(0, 20),
      },
      cat5_unexpectedHomeType: {
        description: 'homeType not in expected normalized set',
        count: cat5.length,
        distinctValues: cat5Values,
        first20: cat5.slice(0, 20),
      },
      cat6_landInCashDeals: {
        description: 'isLand=true but dealTypes includes cash_deal',
        count: cat6.length,
        first20: cat6.slice(0, 20),
      },
      cat7_landWithZestimate: {
        description: 'isLand=true but has non-zero zestimate',
        count: cat7.length,
        first20: cat7.slice(0, 20),
      },
      cat8_missingHomeTypeButActive: {
        description: 'homeType missing/null/empty but isActive=true',
        count: cat8.length,
        first20: cat8.slice(0, 20),
      },
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT_JSON}`);

  // MD
  const sortedFreq = Object.entries(homeTypeCounts).sort((a, b) => b[1] - a[1]);
  const md: string[] = [];
  md.push('# Audit #6 — Land Classification');
  md.push('');
  md.push(`Generated: ${report.generatedAt}`);
  md.push(`Total properties: ${props.length}`);
  md.push('');
  md.push('## homeType frequency table');
  md.push('');
  md.push('| homeType | count | in-expected-set |');
  md.push('|---|---:|---|');
  for (const [k, v] of sortedFreq) {
    md.push(`| ${k} | ${v} | ${EXPECTED_HOMETYPES.has(k) ? 'yes' : 'NO'} |`);
  }
  md.push('');
  if (Object.keys(rawHomeTypeCounts).length > 0) {
    md.push('## rawHomeType frequency table');
    md.push('');
    md.push('| rawHomeType | count |');
    md.push('|---|---:|');
    for (const [k, v] of Object.entries(rawHomeTypeCounts).sort((a, b) => b[1] - a[1])) {
      md.push(`| ${k} | ${v} |`);
    }
    md.push('');
  }
  md.push('## Categories');
  md.push('');
  for (const [key, val] of Object.entries(report.categories)) {
    const v = val as any;
    md.push(`### ${key}`);
    md.push(`- ${v.description}`);
    md.push(`- count: ${v.count}`);
    if (v.distinctValues) {
      md.push(`- distinct values: ${JSON.stringify(v.distinctValues)}`);
    }
    md.push(`- first 20: ${v.first20.join(', ')}`);
    md.push('');
  }
  fs.writeFileSync(OUT_MD, md.join('\n'));
  console.log(`Wrote ${OUT_MD}`);

  // Console summary
  console.log('\n=== Summary ===');
  console.log(`cat1 land-homeType-not-flagged: ${cat1.length}`);
  console.log(`cat2 flagged-land-wrong-homeType: ${cat2.length}`);
  console.log(`cat3 probable-unflagged-land: ${cat3.length}`);
  console.log(`cat5 unexpected-homeType: ${cat5.length}`);
  console.log(`cat6 land-in-cash-deals: ${cat6.length}`);
  console.log(`cat7 land-with-zestimate: ${cat7.length}`);
  console.log(`cat8 missing-homeType-but-active: ${cat8.length}`);
  console.log('\nhomeType frequency:');
  for (const [k, v] of sortedFreq) {
    console.log(`  ${k}: ${v}${EXPECTED_HOMETYPES.has(k) ? '' : '  <-- UNEXPECTED'}`);
  }
}

main();
