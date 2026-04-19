import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';

export const maxDuration = 300;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Accept either a bearer admin/cron secret (scripts, curl, automation)…
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.CRON_SECRET;
  if (adminSecret && authHeader === `Bearer ${adminSecret}`) return true;

  // …or a real admin session (future admin-UI button). Both paths check
  // explicitly so a non-admin authenticated user cannot invoke this even
  // if a UI button is wired up later.
  const session = (await getServerSession(authOptions as any)) as ExtendedSession | null;
  if (session?.user && session.user.role === 'admin') return true;

  return false;
}

/**
 * One-shot admin endpoint: reset queue items stuck in the parked
 * Twilio/AI outreach flow back to `pending` so the GHL cron picks them up.
 *
 * Safe statuses left alone:
 *   - sent_to_ghl  (already outreached via GHL)
 *   - opted_out    (legal — never contact)
 *   - agent_yes    (already confirmed)
 *   - agent_no     (already declined)
 *   - pending      (will be picked up as-is)
 *
 * Statuses reset to `pending` (Twilio/AI states):
 *   - sent             (only got a Twilio SMS, never GHL)
 *   - processing       (may be truly stuck)
 *   - in_conversation
 *   - asking_seller
 *   - no_response
 *   - failed           (retry via GHL)
 *
 * Usage:
 *   POST /api/admin/agent-outreach-queue/reset-for-ghl
 *   Authorization: Bearer $ADMIN_SECRET_KEY
 *   Optional body: { "dryRun": true }
 */

const RESETTABLE_STATUSES = [
  'sent',
  'processing',
  'in_conversation',
  'asking_seller',
  'no_response',
  'failed',
];

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let dryRun = false;
  try {
    const body = await request.json();
    dryRun = body?.dryRun === true;
  } catch {
    // no body — default dryRun=false
  }

  const { db } = getFirebaseAdmin();
  const perStatus: Record<string, number> = {};
  let total = 0;

  for (const status of RESETTABLE_STATUSES) {
    const snap = await db
      .collection('agent_outreach_queue')
      .where('status', '==', status)
      .get();

    perStatus[status] = snap.size;
    total += snap.size;

    if (dryRun || snap.empty) continue;

    // Firestore batches cap at 500 ops
    let batch = db.batch();
    let opsInBatch = 0;

    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        status: 'pending',
        processingStartedAt: null,
        twilioMessageSid: null,
        conversationId: null,
        sentAt: null,
        followUpCount: 0,
        previousStatus: status,
        resetForGHLAt: new Date(),
        updatedAt: new Date(),
      });
      opsInBatch++;

      if (opsInBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    totalReset: total,
    perStatus,
  });
}
