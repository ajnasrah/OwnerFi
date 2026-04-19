/**
 * Property Resolver for Agent Outreach
 *
 * Handles the business logic when an agent confirms (YES) or denies (NO)
 * owner financing on a property. Extracted from the GHL agent-response webhook
 * so it can be reused by SMS, voice, and VAPI handlers.
 */

import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';
import { buildPropertyDocFromQueue } from './queue-to-property';

/**
 * Handle agent confirming owner financing (YES response).
 * Creates/updates property in the properties collection and indexes to Typesense.
 */
export async function handleAgentYes(
  queueItemId: string,
  agentNote?: string
): Promise<{ zpid: string; address: string }> {
  const { db } = getFirebaseAdmin();

  const docRef = db.collection('agent_outreach_queue').doc(queueItemId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error(`Queue item not found: ${queueItemId}`);
  }

  const property = doc.data()!;

  console.log(`✅ [PROPERTY RESOLVER] Agent YES for ${property.address}`);

  // Agent said YES = owner financing confirmed. Can also be a cash deal if
  // price < 80% Zestimate. All mapping lives in buildPropertyDocFromQueue.
  const isCashDeal = property.dealType === 'cash_deal';
  const propertyData = buildPropertyDocFromQueue({
    queueItem: property,
    isOwnerfinance: true,
    isCashDeal,
    source: 'agent_outreach',
    agentNote,
    originalQueueId: queueItemId,
  });

  const propertyDocId = `zpid_${property.zpid}`;
  await db.collection('properties').doc(propertyDocId).set(propertyData, { merge: true });
  console.log(`   ✅ Added to properties: ${property.address}`);

  // Sync to Typesense
  try {
    const savedDoc = await db.collection('properties').doc(propertyDocId).get();
    if (savedDoc.exists) {
      await indexRawFirestoreProperty(propertyDocId, savedDoc.data()!, 'properties');
      console.log(`   ✅ Synced to Typesense: ${property.address}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`   ⚠️ Typesense sync failed: ${msg}`);
  }

  // Update queue item
  await docRef.update({
    status: 'agent_yes',
    agentResponse: 'yes',
    agentResponseAt: new Date(),
    agentNote: agentNote || null,
    routedTo: 'properties',
    updatedAt: new Date(),
  });

  return { zpid: property.zpid, address: property.address };
}

/**
 * Handle agent denying owner financing (NO response).
 */
export async function handleAgentNo(
  queueItemId: string,
  agentNote?: string
): Promise<{ zpid: string; address: string }> {
  const { db } = getFirebaseAdmin();

  const docRef = db.collection('agent_outreach_queue').doc(queueItemId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error(`Queue item not found: ${queueItemId}`);
  }

  const property = doc.data()!;

  console.log(`❌ [PROPERTY RESOLVER] Agent NO for ${property.address}`);

  await docRef.update({
    status: 'agent_no',
    agentResponse: 'no',
    agentResponseAt: new Date(),
    agentNote: agentNote || null,
    routedTo: 'rejected',
    updatedAt: new Date(),
  });

  console.log(`   ✅ Marked as rejected: ${property.address}`);

  return { zpid: property.zpid, address: property.address };
}
