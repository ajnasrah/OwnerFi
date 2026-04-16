/**
 * Backfill agent_outreach_queue status from GHL opportunities CSV.
 *
 * GHL stage → queue state:
 *   Interested       → agent_yes  + create/update properties + Typesense
 *   Not Interested   → agent_no
 *   Pending          → agent_pending (agent working it, no final answer)
 *   New / blank      → leave alone (already sent_to_ghl)
 *
 * DRY-RUN by default. Pass --confirm to actually write.
 * Skips queue docs that are already in the correct state or already resolved.
 * Skips `property_off_market` queue docs (we've hard-marked the property gone —
 * don't re-open).
 */
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { sanitizeDescription } from '../src/lib/description-sanitizer';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';
import { detectFinancingType } from '../src/lib/financing-type-detector';
import * as fs from 'fs';

const CSV_PATH = process.argv[2] || '/Users/abdullahabunasrah/Downloads/opportunities (3).csv';
const CONFIRM = process.argv.includes('--confirm');

function parseCSV(text: string): any[] {
  const rows: string[][] = [];
  let cur: string[] = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur); cur = []; field = ''; }
        if (c === '\r' && text[i+1] === '\n') i++;
      }
      else field += c;
    }
  }
  if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o: any = {};
    header.forEach((h, i) => o[h] = (r[i] || '').trim());
    return o;
  });
}

function normAddr(s: string): string {
  return (s || '').toLowerCase().trim().replace(/[#,\.]/g, '').replace(/\s+/g, ' ');
}

type TargetStatus = 'agent_yes' | 'agent_no' | 'agent_pending' | null;
function targetForStage(stage: string): { status: TargetStatus; resp: string | null } {
  const s = (stage || '').trim().toLowerCase();
  if (s === 'interested') return { status: 'agent_yes', resp: 'yes' };
  if (s === 'not interested') return { status: 'agent_no', resp: 'no' };
  if (s === 'pending') return { status: 'agent_pending', resp: null };
  return { status: null, resp: null };
}

// Skip — already final / property gone / not our concern
const TERMINAL_STATUSES = new Set(['agent_yes', 'agent_no', 'property_off_market']);

async function main() {
  const { db } = getFirebaseAdmin();
  const text = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} CSV rows. Mode: ${CONFIRM ? 'LIVE WRITE' : 'DRY RUN'}\n`);

  const plan = {
    toYes: [] as any[],
    toNo: [] as any[],
    toPending: [] as any[],
    skipAlreadyCorrect: 0,
    skipTerminal: 0,
    skipNotFound: 0,
    skipUnhandledStage: 0,
  };

  for (const r of rows) {
    const stage = r.stage;
    const tgt = targetForStage(stage);
    if (!tgt.status) { plan.skipUnhandledStage++; continue; }

    const firebaseId = r.firebase_id;
    const addressCSV = r['Property Address'] || r['Opportunity Name'];
    const phoneCSV = r.phone;

    let queueDoc = firebaseId ? await db.collection('agent_outreach_queue').doc(firebaseId).get() : null;
    if (!queueDoc?.exists && phoneCSV && addressCSV) {
      const q = await db.collection('agent_outreach_queue')
        .where('phoneNormalized', '==', String(phoneCSV).trim())
        .where('addressNormalized', '==', normAddr(addressCSV))
        .get();
      if (q.size === 1) queueDoc = q.docs[0];
    }
    if (!queueDoc?.exists) { plan.skipNotFound++; continue; }

    const qd: any = queueDoc.data();
    if (qd.status === tgt.status) { plan.skipAlreadyCorrect++; continue; }
    if (TERMINAL_STATUSES.has(qd.status) && qd.status !== tgt.status) {
      // Already final in a different way (e.g., property_off_market) — don't overwrite
      plan.skipTerminal++;
      continue;
    }

    const update: any = {
      queueId: queueDoc.id,
      address: qd.address,
      fromStatus: qd.status,
      toStatus: tgt.status,
      resp: tgt.resp,
      zpid: qd.zpid,
      isCashDeal: qd.dealType === 'cash_deal',
      raw: qd,
    };
    if (tgt.status === 'agent_yes') plan.toYes.push(update);
    else if (tgt.status === 'agent_no') plan.toNo.push(update);
    else if (tgt.status === 'agent_pending') plan.toPending.push(update);
  }

  console.log('=== PLAN ===');
  console.log(`agent_yes updates: ${plan.toYes.length} (also creates properties + Typesense for each)`);
  console.log(`agent_no updates: ${plan.toNo.length}`);
  console.log(`agent_pending updates: ${plan.toPending.length}`);
  console.log(`skip — already correct: ${plan.skipAlreadyCorrect}`);
  console.log(`skip — terminal mismatch (off_market etc.): ${plan.skipTerminal}`);
  console.log(`skip — queue doc not found: ${plan.skipNotFound}`);
  console.log(`skip — unhandled stage (New / blank): ${plan.skipUnhandledStage}`);

  console.log('\n=== YES SAMPLES (first 5) ===');
  plan.toYes.slice(0,5).forEach((u: any) => console.log(`  ${u.queueId} ${u.address} (${u.fromStatus} → agent_yes, cashDeal=${u.isCashDeal})`));
  console.log('\n=== NO SAMPLES (first 5) ===');
  plan.toNo.slice(0,5).forEach((u: any) => console.log(`  ${u.queueId} ${u.address} (${u.fromStatus} → agent_no)`));
  console.log('\n=== PENDING SAMPLES (first 5) ===');
  plan.toPending.slice(0,5).forEach((u: any) => console.log(`  ${u.queueId} ${u.address} (${u.fromStatus} → agent_pending)`));

  if (!CONFIRM) {
    console.log('\nDRY RUN complete. Pass --confirm to apply.');
    return;
  }

  console.log('\n=== APPLYING UPDATES ===');
  const now = new Date();
  const note = `Backfilled from GHL CSV reconcile ${now.toISOString()}`;

  // Apply NO + PENDING first (no downstream side effects)
  for (const u of [...plan.toNo, ...plan.toPending]) {
    await db.collection('agent_outreach_queue').doc(u.queueId).update({
      status: u.toStatus,
      agentResponse: u.resp,
      agentResponseAt: now,
      agentNote: note,
      routedTo: u.toStatus === 'agent_no' ? 'rejected' : 'pending',
      updatedAt: now,
    });
  }
  console.log(`Updated ${plan.toNo.length + plan.toPending.length} queue docs (no + pending)`);

  // Apply YES — also create properties doc + Typesense sync (same as webhook does)
  let propsCreated = 0;
  for (const u of plan.toYes) {
    const property = u.raw;
    const descriptionText = sanitizeDescription(property.rawData?.description || '');
    const financingTypeResult = detectFinancingType(descriptionText);
    const discountPercent = property.priceToZestimateRatio
      ? Math.round((1 - property.priceToZestimateRatio) * 100) : 0;
    const dealTypes = ['owner_finance'];
    if (u.isCashDeal) dealTypes.push('cash_deal');

    const propertyData = {
      zpid: property.zpid,
      url: property.url,
      address: property.address || '',
      streetAddress: property.address || '',
      fullAddress: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zipCode || '',
      price: property.price || 0,
      listPrice: property.price || 0,
      zestimate: property.zestimate || null,
      priceToZestimateRatio: property.priceToZestimateRatio || 0,
      discountPercent: u.isCashDeal ? discountPercent : null,
      bedrooms: property.beds || 0,
      bathrooms: property.baths || 0,
      squareFoot: property.squareFeet || 0,
      homeType: property.propertyType || 'SINGLE_FAMILY',
      homeStatus: 'FOR_SALE',
      agentName: property.agentName,
      agentPhoneNumber: property.agentPhone,
      agentEmail: property.agentEmail || null,
      description: descriptionText,
      financingType: financingTypeResult.financingType || 'Owner Finance',
      allFinancingTypes: financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance'],
      financingTypeLabel: financingTypeResult.displayLabel || 'Owner Finance',
      ownerFinanceVerified: true,
      agentConfirmedOwnerfinance: true,
      ...(u.isCashDeal ? { agentConfirmedMotivated: true } : {}),
      isOwnerfinance: true,
      isCashDeal: u.isCashDeal,
      dealTypes,
      isActive: true,
      source: 'agent_outreach',
      agentConfirmedAt: now,
      agentNote: note,
      originalQueueId: u.queueId,
      importedAt: now,
      createdAt: now,
      lastStatusCheck: now,
      lastScrapedAt: now,
      rawData: property.rawData || null,
    };
    await db.collection('properties').doc(`zpid_${property.zpid}`).set(propertyData);

    try {
      await indexRawFirestoreProperty(`zpid_${property.zpid}`, propertyData, 'properties');
    } catch (e) {
      console.warn(`Typesense sync failed for ${property.zpid}:`, e instanceof Error ? e.message : e);
    }

    await db.collection('agent_outreach_queue').doc(u.queueId).update({
      status: 'agent_yes',
      agentResponse: 'yes',
      agentResponseAt: now,
      agentNote: note,
      routedTo: 'properties',
      updatedAt: now,
    });
    propsCreated++;
  }
  console.log(`Updated ${propsCreated} YES queue docs + created/updated ${propsCreated} properties + Typesense synced`);
}
main().catch(e => { console.error(e); process.exit(1); });
