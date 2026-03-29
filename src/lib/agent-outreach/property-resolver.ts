/**
 * Property Resolver for Agent Outreach
 *
 * Handles the business logic when an agent confirms (YES) or denies (NO)
 * owner financing on a property. Extracted from the GHL agent-response webhook
 * so it can be reused by SMS, voice, and VAPI handlers.
 */

import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { detectFinancingType } from '@/lib/financing-type-detector';

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

  // Detect financing type from description
  const descriptionText = sanitizeDescription(property.rawData?.description || '');
  const financingTypeResult = detectFinancingType(descriptionText);

  const isOwnerfinance = property.dealType === 'potential_owner_finance';
  const isCashDeal = property.dealType === 'cash_deal';

  const discountPercent = property.priceToZestimateRatio
    ? Math.round((1 - property.priceToZestimateRatio) * 100)
    : 0;

  // Add to unified properties collection
  const propertyData: Record<string, unknown> = {
    // Core identifiers
    zpid: property.zpid,
    url: property.url,

    // Address
    address: property.address || '',
    streetAddress: property.address || '',
    fullAddress: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
    city: property.city || '',
    state: property.state || '',
    zipCode: property.zipCode || '',

    // Pricing
    price: property.price || 0,
    listPrice: property.price || 0,
    zestimate: property.zestimate || null,
    priceToZestimateRatio: property.priceToZestimateRatio || 0,
    discountPercent: isCashDeal ? discountPercent : null,

    // Property details
    bedrooms: property.beds || 0,
    bathrooms: property.baths || 0,
    squareFoot: property.squareFeet || 0,
    homeType: property.propertyType || 'SINGLE_FAMILY',
    homeStatus: 'FOR_SALE',

    // Agent info
    agentName: property.agentName,
    agentPhoneNumber: property.agentPhone,
    agentEmail: property.agentEmail || null,

    // Description
    description: descriptionText,

    // Financing type (for owner finance)
    ...(isOwnerfinance && {
      financingType: financingTypeResult.financingType || 'Owner Finance',
      allFinancingTypes: financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance'],
      financingTypeLabel: financingTypeResult.displayLabel || 'Owner Finance',
      ownerFinanceVerified: true,
      agentConfirmedOwnerfinance: true,
    }),

    // Cash deal fields
    ...(isCashDeal && {
      agentConfirmedMotivated: true,
    }),

    // Unified collection flags
    isOwnerfinance,
    isCashDeal,
    dealTypes: isOwnerfinance ? ['owner_finance'] : ['cash_deal'],
    isActive: true,

    // Source tracking
    source: 'agent_outreach',
    agentConfirmedAt: new Date(),
    agentNote: agentNote || null,
    originalQueueId: queueItemId,

    // Metadata
    importedAt: new Date(),
    createdAt: new Date(),
    lastStatusCheck: new Date(),
    lastScrapedAt: new Date(),

    // Full raw data for reference
    rawData: property.rawData || null,
  };

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
