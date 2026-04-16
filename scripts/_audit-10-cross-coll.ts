#!/usr/bin/env npx tsx
/**
 * Audit #10: Cross-collection coherence between `properties` and
 * `agent_outreach_queue` (READ-ONLY).
 */

import * as fs from 'fs';

const PROPS_PATH = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json';
const QUEUE_PATH = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-agent-outreach-queue.json';
const OUT_JSON = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/10-cross-coll.json';
const OUT_MD = '/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/10-cross-coll.md';

interface Prop {
  id?: string;
  _id?: string;
  docId?: string;
  zpid?: any;
  source?: any;
  originalQueueId?: any;
  agentConfirmedOwnerfinance?: any;
  dealTypes?: any;
  ghlContactId?: any;
  ghlOpportunityId?: any;
  verifiedBy?: any;
  lastScrapedAt?: any;
  updatedAt?: any;
  address?: any;
  [k: string]: any;
}

interface Queue {
  id?: string;
  _id?: string;
  docId?: string;
  zpid?: any;
  address?: any;
  status?: any;
  ghlContactId?: any;
  ghlOpportunityId?: any;
  agentResponse?: any;
  agentResponseAt?: any;
  sentToGHLAt?: any;
  phoneNormalized?: any;
  addressNormalized?: any;
  [k: string]: any;
}

function getId(d: any): string {
  return d?.id || d?._id || d?.docId || '(no-id)';
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object') {
    if (typeof v._seconds === 'number') return new Date(v._seconds * 1000);
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    if (v.toDate) {
      try { return v.toDate(); } catch { /* noop */ }
    }
  }
  if (typeof v === 'number') return new Date(v);
  return null;
}

function loadArray(p: string): any[] {
  const raw = fs.readFileSync(p, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : (data.properties || data.docs || Object.values(data));
}

function main() {
  console.log('Loading properties...');
  const props: Prop[] = loadArray(PROPS_PATH);
  console.log(`  ${props.length} properties`);

  console.log('Loading agent_outreach_queue...');
  const queue: Queue[] = loadArray(QUEUE_PATH);
  console.log(`  ${queue.length} queue docs`);

  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // Index properties by zpid, id, ghlContactId, ghlOpportunityId
  const propByZpid = new Map<string, Prop[]>();
  const propById = new Map<string, Prop>();
  const propByOriginalQueueId = new Map<string, Prop[]>();
  const propsBySource: Record<string, number> = {};
  for (const p of props) {
    const id = getId(p);
    propById.set(id, p);
    if (p.zpid !== undefined && p.zpid !== null && p.zpid !== '') {
      const z = String(p.zpid);
      if (!propByZpid.has(z)) propByZpid.set(z, []);
      propByZpid.get(z)!.push(p);
    }
    if (p.originalQueueId) {
      const oq = String(p.originalQueueId);
      if (!propByOriginalQueueId.has(oq)) propByOriginalQueueId.set(oq, []);
      propByOriginalQueueId.get(oq)!.push(p);
    }
    const src = p.source === undefined ? '(missing)' : String(p.source);
    propsBySource[src] = (propsBySource[src] || 0) + 1;
  }

  // Index queue by id, zpid, ghlContactId, ghlOpportunityId
  const queueById = new Map<string, Queue>();
  const queueByZpid = new Map<string, Queue[]>();
  const queueByGhlContact = new Map<string, Queue[]>();
  const queueByGhlOpportunity = new Map<string, Queue[]>();
  for (const q of queue) {
    const id = getId(q);
    queueById.set(id, q);
    if (q.zpid !== undefined && q.zpid !== null && q.zpid !== '') {
      const z = String(q.zpid);
      if (!queueByZpid.has(z)) queueByZpid.set(z, []);
      queueByZpid.get(z)!.push(q);
    }
    if (q.ghlContactId) {
      const k = String(q.ghlContactId);
      if (!queueByGhlContact.has(k)) queueByGhlContact.set(k, []);
      queueByGhlContact.get(k)!.push(q);
    }
    if (q.ghlOpportunityId) {
      const k = String(q.ghlOpportunityId);
      if (!queueByGhlOpportunity.has(k)) queueByGhlOpportunity.set(k, []);
      queueByGhlOpportunity.get(k)!.push(q);
    }
  }

  // ---- Category 1: queue agent_yes but no matching property ----
  const cat1: string[] = [];
  for (const q of queue) {
    if (q.status !== 'agent_yes') continue;
    const qid = getId(q);
    const zpid = q.zpid !== undefined && q.zpid !== null ? String(q.zpid) : '';
    const byQid = propByOriginalQueueId.get(qid);
    const byZpid = zpid ? propByZpid.get(zpid) : undefined;
    const matched = (byQid && byQid.length > 0) || (byZpid && byZpid.length > 0);
    if (!matched) cat1.push(qid);
  }

  // ---- Category 2: property source=agent_outreach but no matching queue doc ----
  const cat2: string[] = [];
  for (const p of props) {
    if (p.source !== 'agent_outreach') continue;
    const oqid = p.originalQueueId ? String(p.originalQueueId) : '';
    if (!oqid) { cat2.push(getId(p)); continue; }
    if (!queueById.has(oqid)) cat2.push(getId(p));
  }

  // ---- Category 3: stuck sends - sent_to_ghl older than 30 days, no response ----
  const cat3: string[] = [];
  for (const q of queue) {
    if (q.status !== 'sent_to_ghl') continue;
    const sent = parseDate(q.sentToGHLAt);
    if (!sent) continue;
    if (now - sent.getTime() <= THIRTY_DAYS_MS) continue;
    if (q.agentResponse) continue; // has a response
    cat3.push(getId(q));
  }

  // ---- Category 4: duplicate phoneNormalized + addressNormalized ----
  const dupeMap = new Map<string, string[]>();
  for (const q of queue) {
    const pn = q.phoneNormalized ? String(q.phoneNormalized) : '';
    const an = q.addressNormalized ? String(q.addressNormalized) : '';
    if (!pn && !an) continue;
    const key = `${pn}||${an}`;
    if (!dupeMap.has(key)) dupeMap.set(key, []);
    dupeMap.get(key)!.push(getId(q));
  }
  const cat4Groups: { key: string; ids: string[] }[] = [];
  for (const [k, ids] of dupeMap.entries()) {
    if (ids.length > 1) cat4Groups.push({ key: k, ids });
  }
  cat4Groups.sort((a, b) => b.ids.length - a.ids.length);
  const cat4AllIds = cat4Groups.flatMap((g) => g.ids);

  // ---- Category 5: agentConfirmedOwnerfinance === true but dealTypes doesn't include owner_finance ----
  const cat5: string[] = [];
  for (const p of props) {
    if (p.agentConfirmedOwnerfinance !== true) continue;
    const dt = Array.isArray(p.dealTypes) ? p.dealTypes.map(String) : [];
    if (!dt.includes('owner_finance')) cat5.push(getId(p));
  }

  // ---- Category 6: property has ghlContactId/ghlOpportunityId but no queue references them ----
  const cat6: string[] = [];
  for (const p of props) {
    const gc = p.ghlContactId ? String(p.ghlContactId) : '';
    const go = p.ghlOpportunityId ? String(p.ghlOpportunityId) : '';
    if (!gc && !go) continue;
    const inC = gc ? queueByGhlContact.has(gc) : false;
    const inO = go ? queueByGhlOpportunity.has(go) : false;
    if (!inC && !inO) cat6.push(getId(p));
  }

  // ---- Category 7: agentResponse=yes but status not starting with agent_ ----
  const cat7: string[] = [];
  for (const q of queue) {
    if (q.agentResponse !== 'yes') continue;
    const st = q.status ? String(q.status) : '';
    if (!st.startsWith('agent_')) cat7.push(getId(q));
  }

  // ---- Category 8: status distribution ----
  const statusFreq: Record<string, number> = {};
  for (const q of queue) {
    const s = q.status === undefined || q.status === null ? '(missing)' : String(q.status);
    statusFreq[s] = (statusFreq[s] || 0) + 1;
  }

  // ---- Category 9: queue agentResponseAt older than 30d but property re-scraped after ----
  const cat9: string[] = [];
  for (const q of queue) {
    const respAt = parseDate(q.agentResponseAt);
    if (!respAt) continue;
    if (now - respAt.getTime() <= THIRTY_DAYS_MS) continue;
    const qid = getId(q);
    const zpid = q.zpid !== undefined && q.zpid !== null ? String(q.zpid) : '';
    // find linked property
    let linked: Prop | undefined;
    const byQid = propByOriginalQueueId.get(qid);
    if (byQid && byQid.length > 0) linked = byQid[0];
    else if (zpid) {
      const byZ = propByZpid.get(zpid);
      if (byZ && byZ.length > 0) linked = byZ[0];
    }
    if (!linked) continue;
    const lastScraped = parseDate(linked.lastScrapedAt);
    if (!lastScraped) continue;
    if (lastScraped.getTime() > respAt.getTime()) {
      cat9.push(qid);
    }
  }

  // ---- Category 10: properties verifiedBy manual_admin ----
  const cat10: string[] = [];
  const verifiedByFreq: Record<string, number> = {};
  for (const p of props) {
    if (p.verifiedBy === undefined || p.verifiedBy === null || p.verifiedBy === '') continue;
    const vb = String(p.verifiedBy);
    verifiedByFreq[vb] = (verifiedByFreq[vb] || 0) + 1;
    if (vb === 'manual_admin') cat10.push(getId(p));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      properties: props.length,
      queue: queue.length,
      propsBySource,
    },
    categories: {
      cat1_queueYesNoProperty: {
        description: "Queue status='agent_yes' but no property matches (by originalQueueId or zpid)",
        count: cat1.length,
        first30: cat1.slice(0, 30),
      },
      cat2_propertyAgentOutreachNoQueue: {
        description: "Property source='agent_outreach' but originalQueueId missing or points to non-existent queue",
        count: cat2.length,
        first20: cat2.slice(0, 20),
      },
      cat3_stuckSends: {
        description: "status='sent_to_ghl' AND sentToGHLAt > 30d ago AND no agentResponse",
        count: cat3.length,
        first20: cat3.slice(0, 20),
      },
      cat4_phoneAddressDupes: {
        description: "Same phoneNormalized+addressNormalized in >1 queue row",
        dupeGroups: cat4Groups.length,
        totalDupeDocs: cat4AllIds.length,
        topGroupsFirst20: cat4Groups.slice(0, 20).map((g) => ({ key: g.key, count: g.ids.length, ids: g.ids })),
      },
      cat5_confirmedButNoOwnerFinance: {
        description: "agentConfirmedOwnerfinance===true but dealTypes does not include 'owner_finance'",
        count: cat5.length,
        first20: cat5.slice(0, 20),
      },
      cat6_propertyGhlNoQueue: {
        description: "Property has ghlContactId/ghlOpportunityId but no queue doc references either",
        count: cat6.length,
        first20: cat6.slice(0, 20),
      },
      cat7_yesResponseWrongStatus: {
        description: "agentResponse='yes' but status does not start with 'agent_'",
        count: cat7.length,
        first20: cat7.slice(0, 20),
      },
      cat8_statusDistribution: {
        description: "Full frequency of queue.status values",
        distribution: statusFreq,
      },
      cat9_staleResponseReScraped: {
        description: "Queue agentResponseAt > 30d ago AND linked property's lastScrapedAt is after the response date",
        count: cat9.length,
        first20: cat9.slice(0, 20),
      },
      cat10_manualAdminVerified: {
        description: "Properties with verifiedBy='manual_admin' (awareness)",
        verifiedByFreq,
        count: cat10.length,
        first20: cat10.slice(0, 20),
      },
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT_JSON}`);

  // Markdown
  const md: string[] = [];
  md.push('# Audit #10 — Cross-Collection Coherence (properties ↔ agent_outreach_queue)');
  md.push('');
  md.push(`Generated: ${report.generatedAt}`);
  md.push(`Properties: ${props.length}   Queue docs: ${queue.length}`);
  md.push('');
  md.push('## Property `source` frequency');
  md.push('');
  md.push('| source | count |');
  md.push('|---|---:|');
  for (const [k, v] of Object.entries(propsBySource).sort((a, b) => b[1] - a[1])) {
    md.push(`| ${k} | ${v} |`);
  }
  md.push('');
  md.push('## Queue `status` distribution');
  md.push('');
  md.push('| status | count |');
  md.push('|---|---:|');
  for (const [k, v] of Object.entries(statusFreq).sort((a, b) => b[1] - a[1])) {
    md.push(`| ${k} | ${v} |`);
  }
  md.push('');
  md.push('## Categories');
  md.push('');
  const catSummaries: [string, number, string[] | undefined][] = [
    ['cat1 queue-yes-no-property', cat1.length, cat1.slice(0, 30)],
    ['cat2 property-agent_outreach-no-queue', cat2.length, cat2.slice(0, 20)],
    ['cat3 stuck sent_to_ghl (>30d, no resp)', cat3.length, cat3.slice(0, 20)],
    ['cat4 phone+address dupes (groups)', cat4Groups.length, undefined],
    ['cat5 confirmed-but-no-owner_finance', cat5.length, cat5.slice(0, 20)],
    ['cat6 property-ghl-no-queue', cat6.length, cat6.slice(0, 20)],
    ['cat7 yes-response-wrong-status', cat7.length, cat7.slice(0, 20)],
    ['cat9 stale-response-re-scraped', cat9.length, cat9.slice(0, 20)],
    ['cat10 manual_admin verified', cat10.length, cat10.slice(0, 20)],
  ];
  md.push('| category | count |');
  md.push('|---|---:|');
  for (const [name, n] of catSummaries) md.push(`| ${name} | ${n} |`);
  md.push('');
  for (const [name, n, ids] of catSummaries) {
    md.push(`### ${name}`);
    md.push(`- count: ${n}`);
    if (ids) md.push(`- sample ids: ${ids.join(', ')}`);
    md.push('');
  }
  md.push('### cat4 dupe top groups (first 20)');
  for (const g of cat4Groups.slice(0, 20)) {
    md.push(`- \`${g.key}\` × ${g.ids.length}: ${g.ids.join(', ')}`);
  }
  md.push('');
  md.push('### verifiedBy frequency');
  md.push('');
  md.push('| verifiedBy | count |');
  md.push('|---|---:|');
  for (const [k, v] of Object.entries(verifiedByFreq).sort((a, b) => b[1] - a[1])) {
    md.push(`| ${k} | ${v} |`);
  }
  fs.writeFileSync(OUT_MD, md.join('\n'));
  console.log(`Wrote ${OUT_MD}`);

  // Console summary
  console.log('\n=== Summary ===');
  console.log(`cat1 queue-yes-no-property:             ${cat1.length}`);
  console.log(`cat2 prop-agent_outreach-no-queue:      ${cat2.length}`);
  console.log(`cat3 stuck-sent_to_ghl:                 ${cat3.length}`);
  console.log(`cat4 phone+addr dupe groups:            ${cat4Groups.length} (total docs: ${cat4AllIds.length})`);
  console.log(`cat5 confirmed-but-no-owner_finance:    ${cat5.length}`);
  console.log(`cat6 property-ghl-no-queue:             ${cat6.length}`);
  console.log(`cat7 yes-response-wrong-status:         ${cat7.length}`);
  console.log(`cat9 stale-response-re-scraped:         ${cat9.length}`);
  console.log(`cat10 manual_admin verified:            ${cat10.length}`);
  console.log('\nstatus freq:');
  for (const [k, v] of Object.entries(statusFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

main();
