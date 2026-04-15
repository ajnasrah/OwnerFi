import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';
import crypto from 'crypto';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Webhook secret for security
const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

/**
 * Verify webhook signature using HMAC SHA-256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null
): { valid: boolean; reason?: string } {
  if (!GHL_WEBHOOK_SECRET) {
    return {
      valid: false,
      reason: 'Server configuration error: GHL_WEBHOOK_SECRET not set'
    };
  }

  if (!signature) {
    return {
      valid: false,
      reason: 'Missing webhook signature header'
    };
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', GHL_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Try multiple signature formats
    const validFormats = [
      signature === expectedSignature,
      signature === `sha256=${expectedSignature}`,
      signature.replace(/^sha256=/, '') === expectedSignature,
    ];

    if (validFormats.some(valid => valid)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: 'Signature mismatch - invalid authentication'
    };
  } catch (error) {
    console.error('Error verifying webhook signature', error);
    return {
      valid: false,
      reason: 'Signature verification error'
    };
  }
}

/**
 * Webhook: Agent Response Handler
 *
 * Receives agent YES/NO responses from GoHighLevel
 * Routes properties to unified 'properties' collection:
 * - YES → properties collection with ownerFinanceVerified=true or isCashDeal=true
 * - NO → marks as rejected in agent_outreach_queue
 *
 * Expected payload from GHL:
 * {
 *   firebaseId: string,
 *   response: 'yes' | 'no',
 *   agentNote?: string,
 *   opportunityId?: string
 * }
 */
export async function POST(request: NextRequest) {
  console.log('📨 [AGENT RESPONSE WEBHOOK] Received webhook');

  try {
    // Read raw body
    const rawBody = await request.text();

    // Parse body — accept JSON OR form-urlencoded (GHL occasionally sends
    // x-www-form-urlencoded depending on how the action was configured).
    let body: any = {};
    const ct = request.headers.get('content-type') || '';
    try {
      if (ct.includes('application/x-www-form-urlencoded')) {
        body = Object.fromEntries(new URLSearchParams(rawBody));
      } else if (rawBody.trim()) {
        body = JSON.parse(rawBody);
      }
    } catch {
      // Try urlencoded as fallback if JSON parse fails
      try { body = Object.fromEntries(new URLSearchParams(rawBody)); } catch { body = {}; }
    }
    if (!body || typeof body !== 'object') body = {};

    // GHL custom webhooks don't support HMAC signatures natively.
    // When GHL_BYPASS_SIGNATURE is "true" (set in Vercel production), skip auth entirely.
    const bypassAuth = process.env.GHL_BYPASS_SIGNATURE === 'true';

    if (!bypassAuth) {
      // Check for signature in headers only (body signatures are a security risk)
      const signature = request.headers.get('x-webhook-signature') ||
                       request.headers.get('x-ghl-signature');

      // Verify webhook signature
      const verification = verifyWebhookSignature(rawBody, signature);
      if (!verification.valid) {
        console.error('❌ [AGENT RESPONSE WEBHOOK] Invalid signature:', verification.reason);
        console.error('   Body keys:', Object.keys(body));
        return NextResponse.json(
          { error: 'Unauthorized', reason: verification.reason },
          { status: 401 }
        );
      }
    } else {
      console.log('✅ [AGENT RESPONSE WEBHOOK] Auth bypassed (GHL_BYPASS_SIGNATURE=true)');
    }
    // GHL can nest custom values inside `customData`, `custom_data`,
    // `data`, or `contact.customFields` depending on how the workflow
    // action was configured. Walk the payload to find the fields
    // wherever they live.
    const findKey = (obj: any, keys: string[]): any => {
      if (!obj || typeof obj !== 'object') return undefined;
      for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      for (const v of Object.values(obj)) {
        if (v && typeof v === 'object') {
          const found = findKey(v, keys);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };

    let firebaseId = findKey(body, ['firebaseId', 'firebase_id', 'firebase_doc_id', 'queueId', 'queue_id']);
    const rawResponse = findKey(body, ['response', 'agent_response', 'agentResponse', 'answer', 'reply', 'status']);
    const agentNote = findKey(body, ['agentNote', 'agent_note', 'note', 'message']);

    // Normalize response — accept "yes"/"no"/"YES"/"No"/"1"/"0"/"true"/"false"/
    // "interested"/"not interested"/"not_interested"/"nope"
    const normalizeResponse = (v: unknown): 'yes' | 'no' | null => {
      if (v === true || v === 1) return 'yes';
      if (v === false || v === 0) return 'no';
      if (typeof v !== 'string') return null;
      const s = v.trim().toLowerCase();
      if (['yes', 'y', 'true', '1', 'interested', 'agree', 'accept', 'accepted'].includes(s)) return 'yes';
      if (['no', 'n', 'false', '0', 'nope', 'not interested', 'not_interested', 'notinterested', 'reject', 'rejected', 'decline', 'declined'].includes(s)) return 'no';
      return null;
    };
    let response = normalizeResponse(rawResponse);

    // Extract identifiers we may need for fallback + for persisting back to the queue doc
    const ghlOpportunityId = findKey(body, ['opportunityId', 'opportunity_id']) || body?.id || null;
    const ghlContactId = findKey(body, ['contact_id', 'contactId']) || null;
    const phoneRaw = findKey(body, ['phone', 'phoneNumber', 'Phone']);
    const oppName = findKey(body, ['opportunity_name', 'opportunityName']);

    // FALLBACK 1: resolve firebaseId when GHL didn't send one (stale/missing
    // custom field on opportunity). Chain:
    //   a) opportunityId → queue.ghlOpportunityId (self-healed on prior hit)
    //   b) phone + normalized address → exactly one sent_to_ghl queue doc
    let fallbackMethod: string | null = null;
    if (!firebaseId) {
      // (a) opportunityId lookup
      if (ghlOpportunityId) {
        const q = await db.collection('agent_outreach_queue')
          .where('ghlOpportunityId', '==', ghlOpportunityId)
          .limit(2).get();
        if (q.size === 1) {
          firebaseId = q.docs[0].id;
          fallbackMethod = 'ghlOpportunityId';
        }
      }
      // (b) phone + address match
      if (!firebaseId && phoneRaw && oppName) {
        const phoneNorm = String(phoneRaw).trim();
        const addrNorm = String(oppName).toLowerCase().trim().replace(/[#,\.]/g, '').replace(/\s+/g, ' ');
        const q = await db.collection('agent_outreach_queue')
          .where('phoneNormalized', '==', phoneNorm)
          .where('addressNormalized', '==', addrNorm)
          .get();
        const live = q.docs.filter(d => d.data().status === 'sent_to_ghl');
        const pool = live.length > 0 ? live : q.docs; // fall back to any match if no sent_to_ghl
        if (pool.length === 1) {
          firebaseId = pool[0].id;
          fallbackMethod = 'phone+address';
        } else if (pool.length > 1) {
          try {
            await db.collection('webhook_debug_logs').add({
              endpoint: 'agent-response',
              status: 'ambiguous_fallback',
              phone: phoneRaw, oppName,
              matchCount: pool.length,
              matchIds: pool.map(d => d.id),
              rawBody: body,
              receivedAt: new Date(),
            });
          } catch (e) { console.error('failed to log webhook debug:', e); }
          return NextResponse.json(
            { error: 'Ambiguous match on phone + address; firebase_id required', matches: pool.length },
            { status: 400 }
          );
        }
      }
    }

    // FALLBACK 2: infer response from workflow.name / pipleline_stage when the
    // response field is missing (GHL dropped empty custom data).
    if (!response) {
      const workflowName = String(body?.workflow?.name || '');
      const pipelineStage = String(body?.pipleline_stage || body?.pipeline_stage || '');
      const searchText = `${workflowName} ${pipelineStage}`.toLowerCase();
      // Order matters: "not interested" must be checked before "interested"
      if (/not[\s_-]?interested|declined|rejected|nope|no thanks/.test(searchText)) {
        response = 'no';
      } else if (/interested|list properties|accepted|\byes\b/.test(searchText)) {
        response = 'yes';
      }
    }

    console.log(`📋 [AGENT RESPONSE WEBHOOK] Processing response for ${firebaseId}`);
    console.log(`   Response: ${response}${fallbackMethod ? ` (resolved via ${fallbackMethod})` : ''}`);
    if (agentNote) {
      console.log(`   Note: ${agentNote}`);
    }

    // Validate required fields
    if (!firebaseId || !response) {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Missing required fields');
      console.error('   Raw body keys:', Object.keys(body));
      try {
        await db.collection('webhook_debug_logs').add({
          endpoint: 'agent-response',
          status: 'missing_fields',
          firebaseIdFound: !!firebaseId,
          responseFound: !!response,
          rawBody: body,
          receivedAt: new Date(),
        });
      } catch (e) { console.error('failed to log webhook debug:', e); }
      return NextResponse.json(
        {
          error: 'Missing required fields: firebaseId and response',
          hint: 'Pass firebase_id + response in custom data, OR include phone + opportunity_name + workflow.name so we can resolve by fallback.',
          bodyKeys: Object.keys(body),
        },
        { status: 400 }
      );
    }

    // Validate response value (already normalized — if still null, raw value was unrecognized)
    if (response !== 'yes' && response !== 'no') {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Invalid response value:', rawResponse);
      try {
        await db.collection('webhook_debug_logs').add({
          endpoint: 'agent-response',
          status: 'invalid_response',
          firebaseId,
          rawResponse,
          rawBody: body,
          receivedAt: new Date(),
        });
      } catch (e) { console.error('failed to log webhook debug:', e); }
      return NextResponse.json(
        {
          error: 'Invalid response value',
          hint: 'Accepted: yes/no, true/false, 1/0, interested/not interested, accepted/rejected',
          received: rawResponse,
        },
        { status: 400 }
      );
    }

    // Get property from agent_outreach_queue
    const docRef = db.collection('agent_outreach_queue').doc(firebaseId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Property not found:', firebaseId);
      return NextResponse.json(
        { error: 'Property not found in queue', firebaseId },
        { status: 404 }
      );
    }

    // Audit log the fallback resolution so we can monitor hit rate / drift
    if (fallbackMethod) {
      try {
        await db.collection('webhook_debug_logs').add({
          endpoint: 'agent-response',
          status: 'resolved_via_fallback',
          method: fallbackMethod,
          firebaseId,
          ghlOpportunityId,
          ghlContactId,
          phone: phoneRaw,
          oppName,
          receivedAt: new Date(),
        });
      } catch (e) { console.error('failed to log webhook debug:', e); }
    }

    const property = doc.data()!;

    console.log(`   Property: ${property.address}`);
    console.log(`   Deal Type: ${property.dealType}`);

    // Idempotency: if the same response was already recorded, return 200
    // without re-running side effects. Prevents double-sending / double-writes
    // on GHL retry.
    if (property.agentResponse === response && property.status && property.status.startsWith('agent_')) {
      console.log('⏭️  [AGENT RESPONSE WEBHOOK] Duplicate — already processed');
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Response already processed (idempotent replay)',
        firebaseId,
        response,
      });
    }

    // Handle agent response
    if (response === 'yes') {
      console.log('✅ [AGENT RESPONSE WEBHOOK] Agent said YES');

      // Detect financing type from description
      const { detectFinancingType } = await import('@/lib/financing-type-detector');
      const descriptionText = sanitizeDescription(property.rawData?.description || '');
      const financingTypeResult = detectFinancingType(descriptionText);

      // Agent said YES = owner financing confirmed. Always mark as OF.
      // Property can also be a cash deal if price < 80% Zestimate.
      const isCashDeal = property.dealType === 'cash_deal';

      const discountPercent = property.priceToZestimateRatio
        ? Math.round((1 - property.priceToZestimateRatio) * 100)
        : 0;

      // Build dealTypes — always includes owner_finance since agent confirmed
      const dealTypes = ['owner_finance'];
      if (isCashDeal) dealTypes.push('cash_deal');

      // Add to unified properties collection
      console.log(`   → Routing to properties (owner_finance${isCashDeal ? ' + cash_deal' : ''})`);

      await db.collection('properties').doc(`zpid_${property.zpid}`).set({
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

        // Agent confirmed OF — always set financing fields
        financingType: financingTypeResult.financingType || 'Owner Finance',
        allFinancingTypes: financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance'],
        financingTypeLabel: financingTypeResult.displayLabel || 'Owner Finance',
        ownerFinanceVerified: true,
        agentConfirmedOwnerfinance: true,

        // Cash deal fields
        ...(isCashDeal && {
          agentConfirmedMotivated: true,
        }),

        // Unified collection flags — agent YES always means owner finance
        isOwnerfinance: true,
        isCashDeal,
        dealTypes,
        isActive: true,

        // Source tracking
        source: 'agent_outreach',
        agentConfirmedAt: new Date(),
        agentNote: agentNote || null,
        originalQueueId: firebaseId,

        // Metadata
        importedAt: new Date(),
        createdAt: new Date(),
        lastStatusCheck: new Date(),
        lastScrapedAt: new Date(),

        // Full raw data for reference
        rawData: property.rawData || null,
      });

      console.log('   ✅ Added to properties');

      // Sync to Typesense for search
      try {
        const propertyDoc = await db.collection('properties').doc(`zpid_${property.zpid}`).get();
        if (propertyDoc.exists) {
          await indexRawFirestoreProperty(`zpid_${property.zpid}`, propertyDoc.data()!, 'properties');
          console.log('   ✅ Synced to Typesense');
        }
      } catch (typesenseErr: unknown) {
        const errMsg = typesenseErr instanceof Error ? typesenseErr.message : 'Unknown error';
        console.error(`   ⚠️ Typesense sync failed: ${errMsg}`);
      }

      // Update agent_outreach_queue — persist GHL IDs so next webhook for this
      // opportunity resolves directly via ghlOpportunityId without fallback.
      await docRef.update({
        status: 'agent_yes',
        agentResponse: 'yes',
        agentResponseAt: new Date(),
        agentNote: agentNote || null,
        routedTo: 'properties',
        ...(ghlOpportunityId && !property.ghlOpportunityId ? { ghlOpportunityId } : {}),
        ...(ghlContactId && !property.ghlContactId ? { ghlContactId } : {}),
        updatedAt: new Date(),
      });

    } else {
      // Agent said NO
      console.log('❌ [AGENT RESPONSE WEBHOOK] Agent said NO');

      await docRef.update({
        status: 'agent_no',
        agentResponse: 'no',
        agentResponseAt: new Date(),
        agentNote: agentNote || null,
        routedTo: 'rejected',
        ...(ghlOpportunityId && !property.ghlOpportunityId ? { ghlOpportunityId } : {}),
        ...(ghlContactId && !property.ghlContactId ? { ghlContactId } : {}),
        updatedAt: new Date(),
      });

      console.log('   ✅ Marked as rejected');
    }

    console.log('✅ [AGENT RESPONSE WEBHOOK] Successfully processed response');

    return NextResponse.json({
      success: true,
      message: 'Agent response processed successfully',
      firebaseId,
      response,
      routedTo: response === 'yes' ? 'properties' : 'rejected'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [AGENT RESPONSE WEBHOOK] Error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler — returns a friendly status so testing the URL in a browser
 * or misconfigured GHL action returns a clear message instead of 405.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'agent-response',
    method: 'POST',
    expects: {
      firebase_id: 'string (queue doc id; also accepts firebaseId)',
      response: 'yes|no|true|false|1|0|interested|not interested|accepted|rejected',
      agent_note: 'string (optional)',
    },
    docs: 'POST with application/json or x-www-form-urlencoded. Fields may be nested inside customData/custom_data/data/contact — we walk the payload.',
  });
}
