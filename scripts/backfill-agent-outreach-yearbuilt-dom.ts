/**
 * Backfill yearBuilt and daysOnZillow for properties created via the GHL
 * agent-response webhook. The "create from queue" path previously dropped
 * these fields; this script copies them back from the agent_outreach_queue
 * item (or its rawData) and reindexes Typesense.
 *
 * Usage:
 *   npx tsx scripts/backfill-agent-outreach-yearbuilt-dom.ts [--dry-run] [--limit N]
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_FLAG = process.argv.findIndex(a => a === '--limit');
const LIMIT = LIMIT_FLAG >= 0 ? Number(process.argv[LIMIT_FLAG + 1]) : 0;

async function findQueueItem(
  property: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const originalQueueId = property.originalQueueId as string | undefined;
  if (originalQueueId) {
    const snap = await db.collection('agent_outreach_queue').doc(originalQueueId).get();
    if (snap.exists) return snap.data() as Record<string, unknown>;
  }
  const zpid = property.zpid as string | number | undefined;
  if (zpid != null) {
    const q = await db
      .collection('agent_outreach_queue')
      .where('zpid', '==', zpid)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].data() as Record<string, unknown>;
  }
  return null;
}

function extractYearBuilt(queue: Record<string, unknown>): number | null {
  const raw = queue.rawData as Record<string, unknown> | undefined;
  const candidates = [queue.yearBuilt, raw?.yearBuilt];
  for (const c of candidates) {
    const n = Number(c ?? 0);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

function extractDaysOnZillow(queue: Record<string, unknown>): number | null {
  const raw = queue.rawData as Record<string, unknown> | undefined;
  const candidates = [queue.daysOnZillow, raw?.daysOnZillow];
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  }
  return null;
}

async function main() {
  console.log(`[backfill] dryRun=${DRY_RUN} limit=${LIMIT || 'unlimited'}`);

  const snap = await db
    .collection('properties')
    .where('source', '==', 'agent_outreach')
    .get();

  console.log(`[backfill] scanning ${snap.size} agent_outreach properties`);

  let checked = 0;
  let patched = 0;
  let missingQueue = 0;
  let nothingToPatch = 0;

  for (const doc of snap.docs) {
    if (LIMIT && checked >= LIMIT) break;
    checked++;
    const p = doc.data() as Record<string, unknown>;
    const ybMissing = !p.yearBuilt || Number(p.yearBuilt) === 0;
    const domMissing = p.daysOnZillow === null || p.daysOnZillow === undefined;
    if (!ybMissing && !domMissing) {
      nothingToPatch++;
      continue;
    }

    const queue = await findQueueItem(p);
    if (!queue) {
      missingQueue++;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (ybMissing) {
      const yb = extractYearBuilt(queue);
      if (yb != null) patch.yearBuilt = yb;
    }
    if (domMissing) {
      const dom = extractDaysOnZillow(queue);
      if (dom != null) patch.daysOnZillow = dom;
    }
    if (Object.keys(patch).length === 0) {
      nothingToPatch++;
      continue;
    }

    console.log(
      `  ${doc.id}  ${p.fullAddress || p.address}  +${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    );

    if (!DRY_RUN) {
      patch.updatedAt = new Date();
      await doc.ref.update(patch);
      try {
        const { indexRawFirestoreProperty } = await import('../src/lib/typesense/sync');
        const fresh = await doc.ref.get();
        if (fresh.exists) {
          await indexRawFirestoreProperty(doc.id, fresh.data()!, 'properties');
        }
      } catch (e) {
        console.warn(`    ⚠️  Typesense reindex failed for ${doc.id}:`, (e as Error).message);
      }
    }
    patched++;
  }

  console.log(`\n[backfill] done: checked=${checked} patched=${patched} missingQueue=${missingQueue} nothingToPatch=${nothingToPatch}${DRY_RUN ? ' (dry-run)' : ''}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
