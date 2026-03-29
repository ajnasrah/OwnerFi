/**
 * Conversation Manager for Agent Outreach
 *
 * Manages SMS conversation state in Firestore.
 * Collections: sms_conversations, sms_opt_outs
 *
 * Pipeline Stages (on agent_outreach_queue):
 *   pending        → Not yet contacted
 *   sent           → Initial SMS sent, waiting for response
 *   in_conversation → Agent replied, AI is handling the conversation
 *   asking_seller  → Agent said they'll ask the seller (follow up in 3 days)
 *   agent_yes      → Confirmed owner financing available
 *   agent_no       → Confirmed no owner financing
 *   no_response    → No reply after 2 follow-ups
 *   opted_out      → Agent requested no further contact
 *   failed         → Technical failure sending SMS
 */

import { getFirebaseAdmin, FieldValue } from '@/lib/scraper-v2/firebase-admin';
import { normalizePhone } from '@/lib/phone-utils';

export type PipelineStage =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'in_conversation'
  | 'asking_seller'
  | 'agent_yes'
  | 'agent_no'
  | 'no_response'
  | 'opted_out'
  | 'failed';

export interface ConversationMessage {
  role: 'outbound' | 'inbound';
  body: string;
  timestamp: Date;
  twilioSid?: string;
  classification?: string;
  aiResponse?: string;
  source?: 'sms' | 'voice';
}

export interface ConversationDoc {
  id: string;
  agentPhone: string;
  agentName: string;
  activeQueueItemIds: string[];
  messages: ConversationMessage[];
  status: 'active' | 'resolved' | 'opted_out';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get existing active conversation or create a new one for this phone number.
 */
export async function getOrCreateConversation(
  phone: string,
  agentName: string,
  queueItemId?: string
): Promise<ConversationDoc> {
  const { db } = getFirebaseAdmin();
  const normalizedPhone = normalizePhone(phone);

  // Look for existing active conversation
  const existing = await db
    .collection('sms_conversations')
    .where('agentPhone', '==', normalizedPhone)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data();

    // Add queue item ID if not already tracked
    if (queueItemId && !data.activeQueueItemIds?.includes(queueItemId)) {
      await doc.ref.update({
        activeQueueItemIds: [...(data.activeQueueItemIds || []), queueItemId],
        updatedAt: new Date(),
      });
    }

    return {
      id: doc.id,
      agentPhone: data.agentPhone,
      agentName: data.agentName,
      activeQueueItemIds: queueItemId
        ? [...new Set([...(data.activeQueueItemIds || []), queueItemId])]
        : data.activeQueueItemIds || [],
      messages: (data.messages || []).map((m: Record<string, unknown>) => ({
        ...m,
        timestamp: (m.timestamp as { toDate?: () => Date })?.toDate?.() || m.timestamp,
      })),
      status: data.status,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
    };
  }

  // Create new conversation
  const newConversation = {
    agentPhone: normalizedPhone,
    agentName,
    activeQueueItemIds: queueItemId ? [queueItemId] : [],
    messages: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const docRef = await db.collection('sms_conversations').add(newConversation);

  return {
    id: docRef.id,
    ...newConversation,
  } as ConversationDoc;
}

/**
 * Append a message to a conversation.
 */
export async function addMessage(
  conversationId: string,
  message: ConversationMessage
): Promise<void> {
  const { db } = getFirebaseAdmin();

  await db.collection('sms_conversations').doc(conversationId).update({
    messages: FieldValue.arrayUnion({
      ...message,
      timestamp: message.timestamp || new Date(),
    }),
    updatedAt: new Date(),
  });
}

/**
 * Mark a conversation as resolved.
 */
export async function resolveConversation(
  conversationId: string,
  resolution: 'yes' | 'no' | 'opted_out'
): Promise<void> {
  const { db } = getFirebaseAdmin();

  await db.collection('sms_conversations').doc(conversationId).update({
    status: resolution === 'opted_out' ? 'opted_out' : 'resolved',
    resolvedWith: resolution,
    updatedAt: new Date(),
  });
}

/**
 * Get all active (sent/in_conversation/asking_seller) queue items for a phone number.
 *
 * Uses indexed compound queries when available. Falls back to status-only query
 * with in-memory phone filtering if composite indexes don't exist yet.
 * (Firestore will log a URL to create the needed index on first failure.)
 */
export async function getActiveQueueItems(phone: string) {
  const { db } = getFirebaseAdmin();
  const normalizedPhone = normalizePhone(phone);

  const activeStatuses: PipelineStage[] = ['sent', 'in_conversation', 'asking_seller'];

  try {
    // Fast path: compound query on phoneNormalized + status (needs composite index)
    const directQuery = await db
      .collection('agent_outreach_queue')
      .where('phoneNormalized', '==', normalizedPhone)
      .where('status', 'in', activeStatuses)
      .get();

    if (!directQuery.empty) {
      return directQuery.docs;
    }

    // Also check agentPhone field (older items may not have phoneNormalized)
    const fallbackQuery = await db
      .collection('agent_outreach_queue')
      .where('agentPhone', '==', normalizedPhone)
      .where('status', 'in', activeStatuses)
      .get();

    return fallbackQuery.docs;
  } catch (err) {
    // If composite index doesn't exist yet, fall back to status-only query + in-memory filter
    console.warn(`⚠️ [getActiveQueueItems] Indexed query failed, using fallback: ${err instanceof Error ? err.message : err}`);

    const results = await db
      .collection('agent_outreach_queue')
      .where('status', 'in', activeStatuses)
      .get();

    return results.docs.filter(doc => {
      const data = doc.data();
      const docPhone = data.phoneNormalized || data.agentPhone || '';
      try {
        return normalizePhone(docPhone) === normalizedPhone;
      } catch {
        return false;
      }
    });
  }
}

/**
 * Update the pipeline stage of a queue item.
 */
export async function updateQueueStage(
  queueItemId: string,
  stage: PipelineStage,
  extra?: Record<string, unknown>
): Promise<void> {
  const { db } = getFirebaseAdmin();

  await db.collection('agent_outreach_queue').doc(queueItemId).update({
    status: stage,
    updatedAt: new Date(),
    ...extra,
  });

  console.log(`📋 [PIPELINE] ${queueItemId} → ${stage}`);
}

/**
 * Check if a phone number has opted out.
 */
export async function isOptedOut(phone: string): Promise<boolean> {
  const { db } = getFirebaseAdmin();
  const normalizedPhone = normalizePhone(phone);

  const doc = await db.collection('sms_opt_outs').doc(normalizedPhone).get();
  return doc.exists;
}

/**
 * Opt out a phone number. Updates all active queue items and conversations.
 */
export async function optOut(phone: string): Promise<void> {
  const { db } = getFirebaseAdmin();
  const normalizedPhone = normalizePhone(phone);

  // Add to opt-out list
  await db.collection('sms_opt_outs').doc(normalizedPhone).set({
    phone: normalizedPhone,
    optedOutAt: new Date(),
  });

  // Update all active queue items for this phone
  const activeItems = await getActiveQueueItems(phone);
  const batch = db.batch();

  for (const doc of activeItems) {
    batch.update(doc.ref, {
      status: 'opted_out',
      updatedAt: new Date(),
    });
  }

  // Update all active conversations for this phone
  const activeConvos = await db
    .collection('sms_conversations')
    .where('agentPhone', '==', normalizedPhone)
    .where('status', '==', 'active')
    .get();

  for (const doc of activeConvos.docs) {
    batch.update(doc.ref, {
      status: 'opted_out',
      updatedAt: new Date(),
    });
  }

  if (activeItems.length > 0 || !activeConvos.empty) {
    await batch.commit();
  }

  console.log(`🚫 [OPT OUT] ${normalizedPhone} opted out. Updated ${activeItems.length} queue items, ${activeConvos.size} conversations.`);
}
