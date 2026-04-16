/**
 * Reconcile GHL opportunities CSV against agent_outreach_queue.
 *
 * Expected mapping:
 *   stage = "Interested"      → queue.status = agent_yes  (agentResponse=yes)
 *   stage = "Not Interested"  → queue.status = agent_no   (agentResponse=no)
 *   stage = "New" / other     → queue.status = sent_to_ghl (no response yet)
 *
 * Also verifies the firebase_id → queue doc actually points at the same
 * property address as GHL's opportunity (guards against stale/cross-wired IDs).
 */
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import * as fs from 'fs';

const CSV_PATH = process.argv[2] || '/Users/abdullahabunasrah/Downloads/opportunities (1).csv';

function parseCSV(text: string): any[] {
  // Minimal CSV parser — handles quoted commas. CSV is clean GHL export.
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

function expectedStatus(stage: string): { status: string | null; agentResponse: string | null } {
  const s = (stage || '').trim().toLowerCase();
  if (s === 'interested') return { status: 'agent_yes', agentResponse: 'yes' };
  if (s === 'not interested') return { status: 'agent_no', agentResponse: 'no' };
  if (s === 'pending') return { status: 'agent_pending', agentResponse: null };
  if (s === 'new' || s === '' || s === 'open') return { status: 'sent_to_ghl', agentResponse: null };
  return { status: null, agentResponse: null }; // unknown stage
}

async function main() {
  const { db } = getFirebaseAdmin();
  const text = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} rows from ${CSV_PATH}\n`);
  
  const results = { match: 0, mismatch: 0, queueDocMissing: 0, addressMismatch: 0, unknownStage: 0 };
  const issues: any[] = [];

  // Filter to agent-outreach pipeline; other pipelines ride in the same export.
  const AGENT_PIPELINE = 'MLS Active/non seller finance';
  const filtered = rows.filter(r => (r.pipeline || '').trim() === AGENT_PIPELINE);
  console.log(`Filtered to ${filtered.length} agent-outreach rows (pipeline = "${AGENT_PIPELINE}")\n`);

  // Mismatch by-direction tally for a clean exec summary
  const mismatchDir: Record<string, number> = {};

  for (const r of filtered) {
    const firebaseId = r.firebase_id;
    const stage = r.stage;
    const addressCSV = r['Property Address'] || r['Opportunity Name'];
    const phoneCSV = r.phone;
    const exp = expectedStatus(stage);
    
    if (!exp.status) {
      results.unknownStage++;
      issues.push({ type: 'UNKNOWN_STAGE', addressCSV, stage, firebaseId });
      continue;
    }
    
    // Fetch queue doc
    let queueId = firebaseId;
    let queueDoc = firebaseId ? await db.collection('agent_outreach_queue').doc(firebaseId).get() : null;
    let fallbackMethod: string | null = null;
    
    // If firebase_id ghost, try phone+address fallback
    if (!queueDoc?.exists && phoneCSV && addressCSV) {
      const q = await db.collection('agent_outreach_queue')
        .where('phoneNormalized','==',String(phoneCSV).trim())
        .where('addressNormalized','==',normAddr(addressCSV))
        .get();
      if (q.size === 1) {
        queueDoc = q.docs[0];
        queueId = q.docs[0].id;
        fallbackMethod = 'phone+address';
      }
    }
    
    if (!queueDoc?.exists) {
      results.queueDocMissing++;
      issues.push({ type: 'QUEUE_MISSING', addressCSV, phoneCSV, firebaseId, stage });
      continue;
    }
    
    const qd: any = queueDoc.data();
    const actualStatus = qd.status;
    const actualResp = qd.agentResponse;
    
    // Verify address matches — guards against wrong-property cross-wiring
    if (normAddr(qd.address) !== normAddr(addressCSV)) {
      results.addressMismatch++;
      issues.push({
        type: 'ADDRESS_MISMATCH',
        csvAddr: addressCSV, queueAddr: qd.address,
        firebaseId, queueId,
      });
      continue;
    }
    
    if (actualStatus === exp.status) {
      results.match++;
    } else {
      results.mismatch++;
      const dirKey = `${stage.trim().toLowerCase()} → ${actualStatus}`;
      mismatchDir[dirKey] = (mismatchDir[dirKey] || 0) + 1;
      issues.push({
        type: 'STATUS_MISMATCH',
        addressCSV, stage,
        expected: exp.status, actual: actualStatus, actualResp,
        firebaseId, queueId, fallbackUsed: fallbackMethod,
      });
    }
  }

  console.log('=== RECONCILIATION SUMMARY ===');
  console.log(results);
  const denom = filtered.length;
  console.log(`\nMatch rate: ${results.match}/${denom} (${denom ? Math.round(100*results.match/denom) : 0}%)`);
  console.log('\nMismatch direction breakdown:');
  Object.entries(mismatchDir).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  
  if (issues.length > 0) {
    console.log(`\n=== ISSUES (${issues.length}) ===`);
    const byType: Record<string, any[]> = {};
    issues.forEach(i => { byType[i.type] = byType[i.type] || []; byType[i.type].push(i); });
    for (const [t, arr] of Object.entries(byType)) {
      console.log(`\n${t}: ${arr.length}`);
      arr.slice(0, 10).forEach(i => console.log(' ', JSON.stringify(i)));
      if (arr.length > 10) console.log(`  ... and ${arr.length - 10} more`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
