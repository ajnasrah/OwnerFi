/**
 * Agent signup outreach — posts new realtor signups to the GHL outreach
 * webhook so the outreach team can begin contacting them.
 *
 * Fire-and-forget; never throws — caller must not await if they want to
 * guarantee non-blocking behavior. Tracks send via `agentOutreachSentAt`
 * on the user doc so backfills and retries don't double-send.
 */

import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo } from '@/lib/logger';

const AGENT_OUTREACH_WEBHOOK_URL =
  process.env.AGENT_OUTREACH_WEBHOOK_URL ||
  'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/52511b61-8384-4c96-90b0-a0e026b1c266';

export interface AgentOutreachPayload {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  target_city: string;
  target_state: string;
}

export async function sendAgentOutreach(payload: AgentOutreachPayload): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(AGENT_OUTREACH_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await logError('[agent-outreach] webhook non-200', {
        action: 'agent_outreach_webhook_error',
        metadata: { userId: payload.id, status: res.status },
      }, new Error(`Webhook returned ${res.status}`));
      return { ok: false, status: res.status };
    }

    await FirebaseDB.updateDocument('users', payload.id, {
      agentOutreachSentAt: Timestamp.now(),
    });

    await logInfo('Agent outreach webhook fired', {
      action: 'agent_outreach_sent',
      userId: payload.id,
    });

    return { ok: true, status: res.status };
  } catch (err) {
    await logError('[agent-outreach] webhook failed', {
      action: 'agent_outreach_webhook_error',
      metadata: { userId: payload.id },
    }, err instanceof Error ? err : new Error(String(err)));
    return { ok: false };
  }
}
