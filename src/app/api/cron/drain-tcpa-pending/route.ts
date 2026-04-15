import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { setGHLContactDND } from '@/lib/gohighlevel-api';
import { revokeBuyerTCPAConsent, type RevocationChannel } from '@/lib/tcpa-revocation';

export const maxDuration = 300;

/**
 * CRON: Drain TCPA pending queues.
 *
 * Two collections feed this drainer:
 *   - tcpa_ghl_dnd_pending        (GHL DND propagation failed or was deferred)
 *   - tcpa_revocation_failures    (the local buyer-side scrub itself failed;
 *                                  typically a Firestore blip)
 *
 * On success the pending doc is deleted; the corresponding audit record in
 * tcpa_revocations is annotated with the GHL contact IDs. On repeated failure
 * a doc is moved to a *_dead collection so the backlog never grows unbounded.
 *
 * Backoff: exponential by retryCount; docs with nextRetryAt > now are skipped.
 *
 * Why this exists: without a drainer, a single GHL outage silently erases
 * our compliance trail — the local scrub succeeds, but the GHL contact keeps
 * receiving messages until someone notices. See setGHLContactDND() for the
 * semantics that produce these pending rows.
 */

const BATCH_SIZE = 25;
const MAX_RETRIES = 10;
const MAX_RUNTIME_MS = 270_000;

function backoffMsFor(retryCount: number): number {
  // 2 min, 5 min, 15 min, 1h, 4h, 12h, 24h, cap at 24h.
  const minutes = [2, 5, 15, 60, 240, 720, 1440, 1440, 1440, 1440];
  const m = minutes[Math.min(retryCount, minutes.length - 1)];
  return m * 60 * 1000;
}

function asDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Firestore Timestamp
  if (typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLock('drain-tcpa-pending', async () => {
    const { db } = getFirebaseAdmin();
    if (!db) throw new Error('Firestore admin unavailable');

    const stats = {
      ghlDndProcessed: 0,
      ghlDndSucceeded: 0,
      ghlDndRescheduled: 0,
      ghlDndDeadLettered: 0,
      revocationProcessed: 0,
      revocationSucceeded: 0,
      revocationRescheduled: 0,
      revocationDeadLettered: 0,
    };

    // ── 1) tcpa_ghl_dnd_pending ──────────────────────────────────────────
    const ghlPending = await db
      .collection('tcpa_ghl_dnd_pending')
      .orderBy('createdAt', 'asc')
      .limit(BATCH_SIZE)
      .get();

    for (const doc of ghlPending.docs) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break;
      const data = doc.data() as Record<string, unknown>;
      const nextRetryAt = asDate(data.nextRetryAt);
      if (nextRetryAt && nextRetryAt.getTime() > Date.now()) continue;

      stats.ghlDndProcessed++;
      const phone = String(data.phone || '');
      const caseId = String(data.caseId || doc.id);
      const retryCount = Number(data.retryCount || 0);

      if (!phone) {
        await doc.ref.delete();
        continue;
      }

      const res = await setGHLContactDND(phone, `TCPA revocation case ${caseId} (retry ${retryCount + 1})`);

      if (res.success) {
        // Annotate the audit record, then drop the pending doc.
        await db.collection('tcpa_revocations').doc(caseId).set(
          {
            ghlDndContactsUpdated: res.contactsUpdated,
            ghlDndContactIds: res.contactIds,
            ghlDndDrainedAt: new Date(),
          },
          { merge: true },
        );
        await doc.ref.delete();
        stats.ghlDndSucceeded++;
        continue;
      }

      if (retryCount + 1 >= MAX_RETRIES) {
        await db.collection('tcpa_ghl_dnd_dead').doc(doc.id).set({
          ...data,
          deadLetteredAt: new Date(),
          finalError: res.error || 'unknown',
          retryCount: retryCount + 1,
        });
        await doc.ref.delete();
        stats.ghlDndDeadLettered++;
        continue;
      }

      await doc.ref.update({
        retryCount: retryCount + 1,
        lastError: res.error || 'unknown',
        lastAttemptAt: new Date(),
        nextRetryAt: new Date(Date.now() + backoffMsFor(retryCount)),
      });
      stats.ghlDndRescheduled++;
    }

    // ── 2) tcpa_revocation_failures ──────────────────────────────────────
    const revFailures = await db
      .collection('tcpa_revocation_failures')
      .orderBy('failedAt', 'asc')
      .limit(BATCH_SIZE)
      .get();

    for (const doc of revFailures.docs) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break;
      const data = doc.data() as Record<string, unknown>;
      const nextRetryAt = asDate(data.nextRetryAt);
      if (nextRetryAt && nextRetryAt.getTime() > Date.now()) continue;

      stats.revocationProcessed++;
      const phone = String(data.phone || '');
      const channel = (String(data.channel || 'unknown') as RevocationChannel);
      const retryCount = Number(data.retryCount || 0);

      if (!phone) {
        await doc.ref.delete();
        continue;
      }

      try {
        await revokeBuyerTCPAConsent(phone, channel, {
          inboundMessageSid: (data.inboundMessageSid as string) || undefined,
          inboundBody: (data.inboundBody as string) || undefined,
          note: `drain retry ${retryCount + 1}`,
        });
        await doc.ref.delete();
        stats.revocationSucceeded++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (retryCount + 1 >= MAX_RETRIES) {
          await db.collection('tcpa_revocation_failures_dead').doc(doc.id).set({
            ...data,
            deadLetteredAt: new Date(),
            finalError: errMsg,
            retryCount: retryCount + 1,
          });
          await doc.ref.delete();
          stats.revocationDeadLettered++;
        } else {
          await doc.ref.update({
            retryCount: retryCount + 1,
            lastError: errMsg,
            lastAttemptAt: new Date(),
            nextRetryAt: new Date(Date.now() + backoffMsFor(retryCount)),
          });
          stats.revocationRescheduled++;
        }
      }
    }

    return stats;
  });

  if (result === null) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'locked' });
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startTime,
    ...result,
  });
}
