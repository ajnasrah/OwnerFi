/**
 * Unified property cleanup script.
 *
 * Stages (run any combination via flags):
 *   --dedupe             Delete duplicate properties by street-key.
 *                        Priority kept: GHL opportunityId > manual > oldest.
 *   --agent-no           Find agent_outreach_queue entries with status='agent_no',
 *                        delete the matching property doc + the queue entry.
 *   --sold               Soft-deactivate (isActive=false) properties with
 *                        homeStatus in SOLD, RECENTLY_SOLD, FOR_RENT.
 *   --garbage-price      Hard-delete properties with listPrice < $10,000.
 *   --missing-fields     Hard-delete properties missing address/city/state.
 *   --all                Run every stage above.
 *
 * Safety:
 *   Dry-run is the default. Pass --live to actually mutate. Writes a full
 *   audit log of every ID touched to scripts/_cleanup-log.json.
 *
 * Usage:
 *   npx tsx scripts/cleanup-properties.ts --all                  # dry-run
 *   npx tsx scripts/cleanup-properties.ts --all --live           # execute
 *   npx tsx scripts/cleanup-properties.ts --dedupe --live
 *   npx tsx scripts/cleanup-properties.ts --agent-no --sold --live
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const args = new Set(process.argv.slice(2));
const LIVE = args.has('--live');
const RUN_ALL = args.has('--all');
const STAGES = {
  dedupe: RUN_ALL || args.has('--dedupe'),
  agentNo: RUN_ALL || args.has('--agent-no'),
  sold: RUN_ALL || args.has('--sold'),
  garbagePrice: RUN_ALL || args.has('--garbage-price'),
  missingFields: RUN_ALL || args.has('--missing-fields'),
};

if (!Object.values(STAGES).some(Boolean)) {
  console.error('No stages selected. Pass one or more of: --dedupe --agent-no --sold --garbage-price --missing-fields --all');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const ts = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 30,
});

const PERMANENT_STATUSES = new Set(['SOLD', 'RECENTLY_SOLD', 'FOR_RENT']);

type AuditEntry = { stage: string; action: string; id: string; detail?: string };
const audit: AuditEntry[] = [];

function log(stage: string, action: string, id: string, detail?: string) {
  audit.push({ stage, action, id, detail });
}

async function deletePropertyEverywhere(id: string, stage: string, reason: string) {
  log(stage, 'delete_property', id, reason);
  if (!LIVE) return;
  try {
    await db.collection('properties').doc(id).delete();
  } catch (err) {
    console.error(`  FS delete ${id} failed:`, (err as Error).message);
  }
  try {
    await ts.collections('properties').documents(id).delete();
  } catch (err: unknown) {
    const httpStatus = (err as { httpStatus?: number })?.httpStatus;
    if (httpStatus !== 404) {
      console.error(`  TS delete ${id} failed:`, (err as Error).message);
    }
  }
}

async function deactivateProperty(id: string, stage: string, reason: string) {
  log(stage, 'deactivate', id, reason);
  if (!LIVE) return;
  try {
    await db.collection('properties').doc(id).update({ isActive: false, deactivatedReason: reason, deactivatedAt: new Date() });
  } catch (err) {
    console.error(`  FS deactivate ${id} failed:`, (err as Error).message);
  }
  // Cloud Function will delete from Typesense when isActive flips to false.
  // Belt-and-suspenders: delete now too.
  try {
    await ts.collections('properties').documents(id).delete();
  } catch (err: unknown) {
    const httpStatus = (err as { httpStatus?: number })?.httpStatus;
    if (httpStatus !== 404) {
      console.error(`  TS delete ${id} failed:`, (err as Error).message);
    }
  }
}

function extractStreetKey(address: string): string {
  if (!address) return '';
  let cleaned = address.toLowerCase().trim();
  cleaned = cleaned.replace(/\s+(unit|apt|ste|suite|#|lot)\s+.*$/i, '');
  cleaned = cleaned.replace(/,.*$/, '');
  return cleaned.trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function stageDedupe(allProps: any[]) {
  console.log('\n━━━ STAGE: DEDUPE ━━━');
  const groups = new Map<string, typeof allProps>();
  for (const p of allProps) {
    const key = extractStreetKey(p.address || p.fullAddress || p.streetAddress || '');
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  let toDelete = 0;
  let groupCount = 0;
  for (const [, props] of groups.entries()) {
    if (props.length < 2) continue;
    groupCount++;
    const sorted = [...props].sort((a, b) => {
      const aGHL = a.source === 'gohighlevel' || (a.opportunityId && a.id === a.opportunityId);
      const bGHL = b.source === 'gohighlevel' || (b.opportunityId && b.id === b.opportunityId);
      if (aGHL && !bGHL) return -1;
      if (!aGHL && bGHL) return 1;
      if (a.source === 'manual' && b.source !== 'manual') return -1;
      if (a.source !== 'manual' && b.source === 'manual') return 1;
      const aT = a.createdAt?.toMillis?.() || 0;
      const bT = b.createdAt?.toMillis?.() || 0;
      return aT - bT;
    });
    const keep = sorted[0];
    for (const d of sorted.slice(1)) {
      await deletePropertyEverywhere(d.id, 'dedupe', `duplicate of ${keep.id}`);
      toDelete++;
    }
  }
  console.log(`  Duplicate groups: ${groupCount}`);
  console.log(`  Properties to delete: ${toDelete}`);
}

async function stageAgentNo() {
  console.log('\n━━━ STAGE: AGENT-NO ━━━');
  const snap = await db.collection('agent_outreach_queue').where('status', '==', 'agent_no').get();
  console.log(`  agent_no queue entries: ${snap.size}`);

  let propertiesDeleted = 0;
  let queueDeleted = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const qDoc of snap.docs) {
    const q = qDoc.data();
    const zpid = q.zpid ? String(q.zpid) : null;
    const address = q.address || '';

    // Find matching property — try zpid first, then address match
    let matchedPropertyId: string | null = null;
    if (zpid) {
      const byZpid = await db.collection('properties').where('zpid', '==', zpid).limit(1).get();
      if (!byZpid.empty) matchedPropertyId = byZpid.docs[0].id;
      if (!matchedPropertyId) {
        const byZpidNum = await db.collection('properties').where('zpid', '==', Number(zpid)).limit(1).get();
        if (!byZpidNum.empty) matchedPropertyId = byZpidNum.docs[0].id;
      }
    }
    if (!matchedPropertyId && address) {
      const key = extractStreetKey(address);
      // Fallback scan — narrow with state if queue has it
      const scan = q.state
        ? await db.collection('properties').where('state', '==', q.state).get()
        : null;
      if (scan) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const match = scan.docs.find((d: any) => extractStreetKey(d.data().address || d.data().fullAddress || '') === key);
        if (match) matchedPropertyId = match.id;
      }
    }

    if (matchedPropertyId) {
      await deletePropertyEverywhere(matchedPropertyId, 'agent_no', `agent declined for queue ${qDoc.id}`);
      propertiesDeleted++;
    } else {
      log('agent_no', 'no_property_match', qDoc.id, `zpid=${zpid} addr=${address}`);
    }

    log('agent_no', 'delete_queue', qDoc.id);
    if (LIVE) await qDoc.ref.delete();
    queueDeleted++;
  }

  console.log(`  Properties deleted: ${propertiesDeleted}`);
  console.log(`  Queue entries deleted: ${queueDeleted}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function stageSold(allProps: any[]) {
  console.log('\n━━━ STAGE: SOLD ━━━');
  let count = 0;
  for (const p of allProps) {
    if (p.isActive === false) continue;
    const status = String(p.homeStatus || '').toUpperCase();
    if (PERMANENT_STATUSES.has(status)) {
      await deactivateProperty(p.id, 'sold', `homeStatus=${status}`);
      count++;
    }
  }
  console.log(`  Properties deactivated: ${count}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function stageGarbagePrice(allProps: any[]) {
  console.log('\n━━━ STAGE: GARBAGE-PRICE ━━━');
  let count = 0;
  for (const p of allProps) {
    const price = Number(p.listPrice || p.price || 0);
    if (price > 0 && price < 10000) {
      await deletePropertyEverywhere(p.id, 'garbage_price', `price=$${price}`);
      count++;
    }
  }
  console.log(`  Properties deleted: ${count}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function stageMissingFields(allProps: any[]) {
  console.log('\n━━━ STAGE: MISSING-FIELDS ━━━');
  let count = 0;
  for (const p of allProps) {
    const addr = String(p.fullAddress || p.address || p.streetAddress || '').trim();
    const city = String(p.city || '').trim();
    const state = String(p.state || '').trim();
    if (!addr || !city || !state) {
      await deletePropertyEverywhere(p.id, 'missing_fields', `addr="${addr}" city="${city}" state="${state}"`);
      count++;
    }
  }
  console.log(`  Properties deleted: ${count}`);
}

async function main() {
  console.log(`\nPROPERTY CLEANUP — ${LIVE ? '🔴 LIVE' : '🟡 DRY RUN'}`);
  console.log(`Stages: ${Object.entries(STAGES).filter(([, v]) => v).map(([k]) => k).join(', ')}\n`);

  console.log('Loading all properties from Firestore...');
  const allSnap = await db.collection('properties').get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProps = allSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  console.log(`  ${allProps.length} total docs\n`);

  if (STAGES.dedupe) await stageDedupe(allProps);
  if (STAGES.agentNo) await stageAgentNo();
  if (STAGES.sold) await stageSold(allProps);
  if (STAGES.garbagePrice) await stageGarbagePrice(allProps);
  if (STAGES.missingFields) await stageMissingFields(allProps);

  const logPath = 'scripts/_cleanup-log.json';
  fs.writeFileSync(logPath, JSON.stringify({ live: LIVE, stages: STAGES, totalActions: audit.length, audit }, null, 2));

  console.log('\n━━━ SUMMARY ━━━');
  const byAction = audit.reduce((acc: Record<string, number>, e) => {
    const k = `${e.stage}:${e.action}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byAction).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(40)} ${n}`));
  console.log(`\nAudit log: ${logPath}`);
  if (!LIVE) console.log('\n⚠️  DRY RUN — re-run with --live to execute.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
