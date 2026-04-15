/**
 * Create agent_outreach_queue docs for every active FOR_SALE property
 * in the 59 targeted zips that has an agent phone. The existing
 * `process-agent-outreach-queue` cron (every 2 hours) will drain them
 * to GHL with firebase_id + contactPhone so responses flow through the
 * newly bulletproofed /webhooks/gohighlevel/agent-response endpoint.
 *
 * Mirrors the schema produced by `run-agent-outreach-scraper` so the
 * cron handles them identically.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';
import { normalizePhone } from '../src/lib/phone-utils';

const DRY_RUN = process.argv.includes('--dry-run');
const CONFIRMED = process.argv.includes('--confirm');

if (!DRY_RUN && !CONFIRMED) {
  console.error('Refusing to run: pass --dry-run to preview, or --confirm to actually enqueue.');
  console.error('A non-dry run writes to agent_outreach_queue, which the cron drains to GHL → real outbound SMS.');
  process.exit(1);
}

const ACTIVE_STATUSES = new Set(['FOR_SALE','PRE_FORECLOSURE','FORECLOSED','FOR_AUCTION','FORECLOSURE']);

async function main() {
  const { db } = getFirebaseAdmin();
  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));

  // Collect eligible properties
  type Candidate = { doc: FirebaseFirestore.QueryDocumentSnapshot; d: FirebaseFirestore.DocumentData };
  const candidates: Candidate[] = [];
  for (const chunk of chunks) {
    const snap = await db.collection('properties').where('zipCode','in',chunk).get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.isActive === false) return;
      const hs = String(d.homeStatus || '').toUpperCase();
      if (hs && !ACTIVE_STATUSES.has(hs)) return;
      const phone = d.agentPhoneNumber || d.agentPhone;
      if (!phone) return;
      candidates.push({ doc, d });
    });
  }
  console.log(`Candidates: ${candidates.length}`);

  // Dedup against existing queue by zpid (should be 0 based on earlier audit)
  const zpidList = candidates.map(c => Number(c.d.zpid)).filter(z => Number.isFinite(z));
  const existingZpids = new Set<number>();
  for (let i = 0; i < zpidList.length; i += 30) {
    const batch = zpidList.slice(i, i + 30);
    const qs = await db.collection('agent_outreach_queue').where('zpid','in',batch).get();
    qs.forEach(q => { const z = q.data().zpid; if (typeof z === 'number') existingZpids.add(z); });
  }
  const toInsert = candidates.filter(c => !existingZpids.has(Number(c.d.zpid)));
  console.log(`Already in queue: ${existingZpids.size}`);
  console.log(`Net-new to insert: ${toInsert.length}`);

  if (DRY_RUN || toInsert.length === 0) {
    if (toInsert.length > 0) console.log('[DRY RUN] Would insert', toInsert.length);
    return;
  }

  let inserted = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const { d } of toInsert) {
    const zpid = Number(d.zpid);
    const streetAddr = d.streetAddress || d.fullAddress || '';
    const agentPhone = String(d.agentPhoneNumber || d.agentPhone || '').trim();
    const phoneNormalized = normalizePhone(agentPhone);
    const addressNormalized = streetAddr.toLowerCase().trim().replace(/[#,\.]/g, '').replace(/\s+/g, ' ');

    const price = d.listPrice ?? d.price ?? 0;
    const zestimate = d.zestimate ?? d.estimate ?? 0;

    // Determine dealType: cash_deal if flagged, else potential_owner_finance
    // (cron supports both — cash deals use agent outreach too, just with
    // a different GHL conversation template).
    const dealType = d.isCashDeal ? 'cash_deal' : 'potential_owner_finance';

    const ref = db.collection('agent_outreach_queue').doc();
    batch.set(ref, {
      zpid,
      url: d.url || `https://www.zillow.com/homedetails/${zpid}_zpid/`,
      address: streetAddr,
      city: d.city || '',
      state: d.state || '',
      zipCode: d.zipCode || '',
      price,
      zestimate,
      priceToZestimateRatio: zestimate > 0 ? price / zestimate : null,
      beds: d.bedrooms || 0,
      baths: d.bathrooms || 0,
      squareFeet: d.squareFoot || d.livingArea || 0,
      propertyType: d.homeType || d.propertyType || 'SINGLE_FAMILY',
      agentName: d.agentName || 'Agent',
      agentPhone,
      agentEmail: d.agentEmail || null,
      imgSrc: d.firstPropertyImage || d.images?.primary || d.imgSrc || null,
      phoneNormalized,
      addressNormalized,
      dealType,
      status: 'pending',
      source: 'targeted-zips-backfill',
      addedAt: new Date(),
    });

    batchCount++;
    if (batchCount >= 400) {
      await batch.commit();
      inserted += batchCount;
      console.log(`Committed ${inserted}/${toInsert.length}`);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) { await batch.commit(); inserted += batchCount; }

  console.log(`\n✓ Inserted ${inserted} queue docs with status=pending`);
  console.log(`The process-agent-outreach-queue cron will drain these in batches of 50.`);
}

main().catch(e => { console.error(e); process.exit(1); });
