import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';

export const maxDuration = 300;

/**
 * CRON: Sweep abandoned agent-outreach queue items.
 *
 * Finds queue docs that have been in `sent_to_ghl` for longer than
 * ABANDON_AFTER_DAYS without an agent response and marks them
 * `abandoned`. Prevents the collection from growing forever and keeps
 * `sent_to_ghl` counts meaningful for ops dashboards.
 *
 * Schedule: daily (added to vercel.json).
 * Auth: CRON_SECRET bearer.
 */

const ABANDON_AFTER_DAYS = 90;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = getFirebaseAdmin();

  return NextResponse.json(await withCronLock('sweep-abandoned-outreach', async () => {
    const cutoff = new Date(Date.now() - ABANDON_AFTER_DAYS * 24 * 60 * 60 * 1000);
    console.log(`🧹 [SWEEP ABANDONED] cutoff=${cutoff.toISOString()} (abandon older than ${ABANDON_AFTER_DAYS}d)`);

    // Use sentToGHLAt for the cutoff since that's when the outbound started.
    const snap = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'sent_to_ghl')
      .where('sentToGHLAt', '<', cutoff)
      .limit(2000)
      .get();

    console.log(`   Found ${snap.size} candidates`);

    let marked = 0;
    let batch = db.batch();
    let inBatch = 0;
    const now = new Date();

    for (const doc of snap.docs) {
      // Defensive: skip if an agent response landed since the query
      const d = doc.data();
      if (d.agentResponseAt || d.status !== 'sent_to_ghl') continue;

      batch.update(doc.ref, {
        status: 'abandoned',
        abandonedAt: now,
        abandonedReason: `no agent response in ${ABANDON_AFTER_DAYS}d`,
        updatedAt: now,
      });
      inBatch++;
      marked++;

      if (inBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }

    if (inBatch > 0) await batch.commit();

    await db.collection('cron_logs').add({
      cron: 'sweep-abandoned-outreach',
      status: 'completed',
      candidates: snap.size,
      marked,
      cutoff,
      timestamp: now,
    });

    console.log(`✅ [SWEEP ABANDONED] marked ${marked} abandoned`);
    return { success: true, candidates: snap.size, marked };
  }));
}
