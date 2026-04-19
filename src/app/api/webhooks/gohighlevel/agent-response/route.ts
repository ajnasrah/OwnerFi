import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';
import { normalizeHomeType } from '@/lib/scraper-v2/property-transformer';
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

    // Auth: accept either (a) a shared secret in a custom header — GHL
    // custom webhook actions can set custom headers, so this is the
    // path GHL actually uses in prod; in production GHL is configured to
    // send the raw secret in `x-webhook-signature` — or (b) an actual
    // HMAC signature if present. Always fail closed; no NODE_ENV bypass.
    const sharedSecret = process.env.GHL_WEBHOOK_SECRET;
    const signature = request.headers.get('x-webhook-signature')
      || request.headers.get('x-ghl-signature');
    const candidateSecrets = [
      request.headers.get('x-webhook-secret'),
      request.headers.get('x-ghl-secret'),
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null,
      // GHL workflows send the raw secret here, not a computed HMAC.
      signature,
    ].filter((v): v is string => !!v);

    let authed = false;
    if (sharedSecret && candidateSecrets.some(s => s === sharedSecret)) {
      authed = true;
    } else if (signature) {
      const verification = verifyWebhookSignature(rawBody, signature);
      authed = verification.valid;
    }

    if (!authed) {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Unauthorized — no valid shared secret or signature');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    // Idempotency: prefer a GHL-sourced request ID (opportunityId change
    // or explicit idempotency key) over a time window. Time-only windows
    // either swallow legitimate re-flips (too wide) or wave duplicates
    // through on slow networks (too narrow).
    //
    // Dedupe on (response, opportunityId) — if GHL re-fires the same
    // workflow action with the same opportunity/response pair and we've
    // already processed it, drop. A legitimate re-flip flips response,
    // so it'll pass.
    const priorRespondedOppId = property.lastProcessedOpportunityId;
    if (
      property.agentResponse === response &&
      property.status && property.status.startsWith('agent_') &&
      ghlOpportunityId &&
      priorRespondedOppId === ghlOpportunityId
    ) {
      console.log('⏭️  [AGENT RESPONSE WEBHOOK] Duplicate (same response + same opportunityId) — skipping');
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Response already processed for this opportunity',
        firebaseId,
        response,
      });
    }
    // Also keep a short 5-minute safety net for webhooks that arrive
    // without a usable opportunityId — GHL sometimes retries the same
    // event every ~5s. Wider than the old 60s so a transient network
    // blip + retry doesn't get dropped, still narrow enough that a
    // legitimate human re-flip (minutes+) rerun the flow.
    const lastRespAt = property.agentResponseAt?.toDate?.()?.getTime?.() || 0;
    if (
      !ghlOpportunityId &&
      property.agentResponse === response &&
      property.status && property.status.startsWith('agent_') &&
      lastRespAt && (Date.now() - lastRespAt) < 5 * 60_000
    ) {
      console.log('⏭️  [AGENT RESPONSE WEBHOOK] Duplicate within 5min (no opp id) — skipping');
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Response already processed within last 5min (GHL retry guard)',
        firebaseId,
        response,
      });
    }

    // Handle agent response
    if (response === 'yes') {
      console.log('✅ [AGENT RESPONSE WEBHOOK] Agent said YES');

      // Distressed listings (auction, foreclosure, bank-owned) can't be
      // owner-finance — the posted price is an opening bid / REO estimate,
      // not a seller's asking price. Even if the agent says yes, we refuse
      // to tag these as OF. Accept as cash_deal only.
      const isDistressed =
        property.isAuction === true ||
        property.isForeclosure === true ||
        property.isBankOwned === true ||
        property.rawData?.isAuction === true ||
        property.rawData?.isForeclosure === true ||
        property.rawData?.isBankOwned === true;

      if (isDistressed) {
        console.warn(`   ⚠️ Distressed listing (auction/foreclosure/REO) — ignoring OF on YES, tagging cash_deal only`);
      }

      const isCashDeal = property.dealType === 'cash_deal' || isDistressed;
      const dealTypes: string[] = isDistressed ? ['cash_deal'] : ['owner_finance'];
      if (isCashDeal && !dealTypes.includes('cash_deal')) dealTypes.push('cash_deal');

      // Resolve the property doc. Try zpid first, then fall back to
      // city+state+normalized-address — GHL occasionally links opportunities
      // to listings whose zpid in the queue is stale (Zillow reassigns zpids
      // on re-list).
      const hasHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v.trim());
      const normAddr = (s: string) => String(s || '').toLowerCase().trim().replace(/[#,\.]/g, '').replace(/\s+/g, ' ');

      let propertyDocId = `zpid_${property.zpid}`;
      let resolvedVia: 'zpid' | 'address' | 'created' = 'zpid';
      let existingSnap = await db.collection('properties').doc(propertyDocId).get();

      if (!existingSnap.exists && property.address && property.city && property.state) {
        const target = normAddr(property.address);
        const addrSnap = await db.collection('properties')
          .where('city', '==', property.city)
          .where('state', '==', property.state)
          .get();
        for (const d of addrSnap.docs) {
          const dAddr = normAddr(d.data().address || d.data().streetAddress || '');
          if (dAddr && dAddr === target) {
            propertyDocId = d.id;
            existingSnap = d;
            resolvedVia = 'address';
            console.log(`   ℹ️  zpid lookup missed; matched by address → ${propertyDocId}`);
            break;
          }
        }
      }

      // Lift the image URL from the queue item / rawData so the property doc
      // carries a photo (UI/search hide properties without one).
      const primaryImage =
        (hasHttp(property.primaryImage) && property.primaryImage) ||
        (hasHttp(property.firstPropertyImage) && property.firstPropertyImage) ||
        (hasHttp(property.imgSrc) && property.imgSrc) ||
        (hasHttp(property.hiResImageLink) && property.hiResImageLink) ||
        (hasHttp(property.desktopWebHdpImageLink) && property.desktopWebHdpImageLink) ||
        (hasHttp(property.mediumImageLink) && property.mediumImageLink) ||
        (hasHttp(property.rawData?.hiResImageLink) && property.rawData.hiResImageLink) ||
        (hasHttp(property.rawData?.desktopWebHdpImageLink) && property.rawData.desktopWebHdpImageLink) ||
        (hasHttp(property.rawData?.mediumImageLink) && property.rawData.mediumImageLink) ||
        (Array.isArray(property.propertyImages) && hasHttp(property.propertyImages[0]) && property.propertyImages[0]) ||
        (Array.isArray(property.imageUrls) && hasHttp(property.imageUrls[0]) && property.imageUrls[0]) ||
        null;
      const gallery: string[] | null = Array.isArray(property.propertyImages) && property.propertyImages.length > 0
        ? property.propertyImages
        : Array.isArray(property.imageUrls) && property.imageUrls.length > 0
          ? property.imageUrls
          : null;

      // Resolve lat/lng. Prefer anything already on the existing doc or the
      // queue rawData; otherwise geocode. Without a location, Cloud Function
      // writes no `location` field to Typesense and the property becomes
      // invisible to buyer geo-radius searches.
      const existingForCoords = existingSnap.exists ? existingSnap.data()! : {};
      const rawLat = Number(
        existingForCoords.latitude ??
        property.latitude ??
        property.rawData?.latitude ??
        property.rawData?.geoPoint?.latitude ??
        NaN
      );
      const rawLng = Number(
        existingForCoords.longitude ??
        property.longitude ??
        property.rawData?.longitude ??
        property.rawData?.geoPoint?.longitude ??
        NaN
      );
      let latitude: number | null = Number.isFinite(rawLat) && rawLat !== 0 ? rawLat : null;
      let longitude: number | null = Number.isFinite(rawLng) && rawLng !== 0 ? rawLng : null;

      if ((latitude == null || longitude == null) && property.address) {
        try {
          const { geocodeAddress } = await import('@/lib/geocode');
          const coords = await geocodeAddress({
            street: property.address,
            city: property.city,
            state: property.state,
            zip: property.zipCode,
          });
          if (coords) {
            latitude = coords.lat;
            longitude = coords.lng;
            console.log(`   📍 geocoded ${property.address} → (${latitude}, ${longitude})`);
          } else {
            console.warn(`   ⚠️ geocode failed for ${property.address} — property will have no location in Typesense`);
          }
        } catch (err) {
          console.error('   ⚠️ geocode error', err);
        }
      }

      if (existingSnap.exists) {
        // Flag-flip only. Keep all existing Zillow fields (address, price, images, etc.).
        console.log(`   → Flag-flip existing ${propertyDocId} (${resolvedVia})`);
        const existing = existingSnap.data()!;
        const flip: Record<string, unknown> = {
          isActive: true,
          // Distressed listings tagged cash_deal only; isOwnerfinance stays false.
          isOwnerfinance: !isDistressed,
          isCashDeal,
          dealTypes,
          ownerFinanceVerified: !isDistressed,
          agentConfirmedOwnerfinance: !isDistressed,
          ...(isDistressed && { agentConfirmedDistressedCashOnly: true }),
          // Preserve the FIRST confirmation timestamp; re-sends shouldn't bump it.
          ...(!existing.agentConfirmedAt && { agentConfirmedAt: new Date() }),
          financingType: isDistressed ? (existing.financingType || null) : 'Owner Finance',
          financingTypeLabel: isDistressed ? (existing.financingTypeLabel || null) : 'Owner Finance',
          allFinancingTypes: isDistressed ? (existing.allFinancingTypes || []) : ['Owner Finance'],
          source: 'agent_outreach',
          originalQueueId: firebaseId,
          agentNote: agentNote || null,
          lastStatusCheck: new Date(),
          updatedAt: new Date(),
        };
        // Only overwrite image fields if the existing doc is missing them.
        if (primaryImage && !hasHttp(existing.primaryImage) && !hasHttp(existing.firstPropertyImage)) {
          flip.primaryImage = primaryImage;
          flip.firstPropertyImage = primaryImage;
          flip.imgSrc = primaryImage;
          flip.hiResImageLink = property.hiResImageLink || primaryImage;
          flip.mediumImageLink = property.mediumImageLink || primaryImage;
          flip.desktopWebHdpImageLink = property.desktopWebHdpImageLink || primaryImage;
        }
        if (gallery && gallery.length > 0 && !Array.isArray(existing.propertyImages)) {
          flip.propertyImages = gallery;
          flip.imageUrls = gallery;
          flip.photoCount = property.photoCount || gallery.length;
        }
        // ── Backfill queue-derived structural/financial fields when existing
        // doc is missing them. Refresh-zillow-status cron will redo these on
        // its rotation, but this ensures day-1 OF docs aren't sparse.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pickQ = (...candidates: any[]): any => {
          for (const c of candidates) if (c != null && c !== 0 && c !== '') return c;
          return null;
        };
        const qYearBuilt = Number(property.yearBuilt ?? property.rawData?.yearBuilt ?? 0) || 0;
        if (qYearBuilt > 0 && (!existing.yearBuilt || Number(existing.yearBuilt) === 0)) flip.yearBuilt = qYearBuilt;

        const qDaysOnZillow = property.daysOnZillow ?? property.rawData?.daysOnZillow;
        if (qDaysOnZillow != null && existing.daysOnZillow == null) flip.daysOnZillow = qDaysOnZillow;

        const qRent = pickQ(property.rentZestimate, property.rentEstimate, property.rawData?.rentZestimate, property.rawData?.rentEstimate);
        if (qRent && !existing.rentEstimate) { flip.rentEstimate = qRent; flip.rentZestimate = qRent; }

        const qLot = pickQ(property.lotSize, property.rawData?.lotAreaValue, property.rawData?.lotSize);
        if (qLot && !existing.lotSize && !existing.lotSquareFoot) { flip.lotSize = qLot; flip.lotSquareFoot = qLot; }

        const qHoa = pickQ(property.hoa, property.rawData?.monthlyHoaFee, property.rawData?.hoaFee);
        if (qHoa && !existing.hoa) { flip.hoa = qHoa; flip.monthlyHoaFee = qHoa; }

        const qTax = pickQ(
          property.annualTaxAmount,
          Array.isArray(property.rawData?.taxHistory) ? property.rawData.taxHistory.find((t: any) => t?.taxPaid)?.taxPaid : null,
        );
        if (qTax && !existing.annualTaxAmount) flip.annualTaxAmount = qTax;

        const qTaxRate = pickQ(property.propertyTaxRate, property.rawData?.propertyTaxRate);
        if (qTaxRate && !existing.propertyTaxRate) flip.propertyTaxRate = qTaxRate;

        const qInsurance = pickQ(property.annualHomeownersInsurance, property.rawData?.annualHomeownersInsurance);
        if (qInsurance && !existing.annualHomeownersInsurance) flip.annualHomeownersInsurance = qInsurance;

        const qCounty = pickQ(property.county, property.rawData?.county);
        if (qCounty && !existing.county) flip.county = qCounty;

        const qParcel = pickQ(property.parcelId, property.rawData?.parcelId, property.rawData?.resoFacts?.parcelNumber);
        if (qParcel && !existing.parcelId) flip.parcelId = qParcel;

        const qMls = pickQ(property.mlsId, property.rawData?.attributionInfo?.mlsId, property.rawData?.mlsid);
        if (qMls && !existing.mlsId) flip.mlsId = qMls;

        const qVirtual = pickQ(property.virtualTourUrl, property.rawData?.virtualTourUrl, property.rawData?.thirdPartyVirtualTour?.externalUrl);
        if (qVirtual && !existing.virtualTourUrl) flip.virtualTourUrl = qVirtual;

        const qBrokerName = pickQ(property.brokerName, property.rawData?.attributionInfo?.brokerName, property.rawData?.brokerName);
        if (qBrokerName && !existing.brokerName) flip.brokerName = qBrokerName;

        const qBrokerPhone = pickQ(property.brokerPhone, property.rawData?.attributionInfo?.brokerPhoneNumber, property.rawData?.brokerPhoneNumber);
        if (qBrokerPhone && !existing.brokerPhoneNumber) flip.brokerPhoneNumber = qBrokerPhone;

        const qAgentEmail = pickQ(property.agentEmail, property.rawData?.attributionInfo?.agentEmail, property.rawData?.agentEmail);
        if (qAgentEmail && !existing.agentEmail) flip.agentEmail = qAgentEmail;

        // Backfill lat/lng so Cloud Function syncs location to Typesense.
        if (latitude != null && longitude != null && (!existing.latitude || !existing.longitude)) {
          flip.latitude = latitude;
          flip.longitude = longitude;
        }
        await db.collection('properties').doc(propertyDocId).set(flip, { merge: true });
      } else {
        // Property doesn't exist — create from queue data as a safety net.
        resolvedVia = 'created';
        console.log(`   → Creating ${propertyDocId} from queue (no existing match)`);
        const { detectFinancingType } = await import('@/lib/financing-type-detector');
        const descriptionText = sanitizeDescription(property.rawData?.description || '');
        const financingTypeResult = detectFinancingType(descriptionText);
        const discountPercent = property.priceToZestimateRatio
          ? Math.round((1 - property.priceToZestimateRatio) * 100)
          : 0;

        // ── Pull every field we have in the queue rawData, so day-1 OF docs
        // land with full structural + financial detail (no gaps waiting on
        // the 3-day refresh cron). ───────────────────────────────────────
        const r = (property.rawData || {}) as Record<string, any>;
        const createRent = property.rentZestimate || property.rentEstimate || r.rentZestimate || r.rentEstimate || null;
        const createYearBuilt = Number(property.yearBuilt ?? r.yearBuilt ?? 0) || 0;
        const createLotSize = property.lotSize || r.lotAreaValue || r.lotSize || null;
        const createHoa = property.hoa || r.monthlyHoaFee || r.hoaFee || 0;
        const createTax = property.annualTaxAmount
          || (Array.isArray(r.taxHistory) ? r.taxHistory.find((t: any) => t?.taxPaid)?.taxPaid : 0)
          || null;
        const createTaxRate = property.propertyTaxRate ?? r.propertyTaxRate ?? null;
        const createInsurance = property.annualHomeownersInsurance ?? r.annualHomeownersInsurance ?? null;
        const createCounty = property.county || r.county || null;
        const createParcel = property.parcelId || r.parcelId || r.resoFacts?.parcelNumber || null;
        const createMls = property.mlsId || r.attributionInfo?.mlsId || r.mlsid || null;
        const createVirtual = property.virtualTourUrl || r.virtualTourUrl || r.thirdPartyVirtualTour?.externalUrl || null;
        const createBrokerName = property.brokerName || r.attributionInfo?.brokerName || r.brokerName || null;
        const createBrokerPhone = property.brokerPhone || r.attributionInfo?.brokerPhoneNumber || r.brokerPhoneNumber || null;

        await db.collection('properties').doc(propertyDocId).set({
          zpid: property.zpid,
          url: property.url,
          hdpUrl: property.hdpUrl || r.hdpUrl || null,
          virtualTourUrl: createVirtual,
          mlsId: createMls,
          parcelId: createParcel,
          county: createCounty,

          address: property.address || '',
          streetAddress: property.address || '',
          fullAddress: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
          city: property.city || '',
          state: property.state || '',
          zipCode: property.zipCode || '',
          zipcode: property.zipCode || '',

          price: property.price || 0,
          listPrice: property.price || 0,
          zestimate: property.zestimate || null,
          estimate: property.zestimate || null,
          rentEstimate: createRent,
          rentZestimate: createRent,
          priceToZestimateRatio: property.priceToZestimateRatio || 0,
          discountPercent: isCashDeal ? discountPercent : null,

          bedrooms: property.beds || 0,
          bathrooms: property.baths || 0,
          squareFoot: property.squareFeet || 0,
          squareFeet: property.squareFeet || 0,
          lotSize: createLotSize,
          lotSquareFoot: createLotSize,
          yearBuilt: createYearBuilt,
          daysOnZillow: property.daysOnZillow ?? r.daysOnZillow ?? null,
          homeType: normalizeHomeType(property.propertyType),
          propertyType: property.propertyType || 'SINGLE_FAMILY',
          isLand: normalizeHomeType(property.propertyType) === 'land',
          homeStatus: property.homeStatus || 'FOR_SALE',
          keystoneHomeStatus: property.keystoneHomeStatus || r.keystoneHomeStatus || null,

          hoa: createHoa,
          monthlyHoaFee: createHoa || null,
          annualTaxAmount: createTax,
          propertyTaxRate: createTaxRate,
          annualHomeownersInsurance: createInsurance,

          agentName: property.agentName,
          agentPhoneNumber: property.agentPhone,
          agentEmail: property.agentEmail || r.attributionInfo?.agentEmail || null,
          brokerName: createBrokerName,
          brokerPhoneNumber: createBrokerPhone,

          description: descriptionText,
          financingType: financingTypeResult.financingType || 'Owner Finance',
          allFinancingTypes: isDistressed ? [] : (financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance']),
          financingTypeLabel: isDistressed ? null : (financingTypeResult.displayLabel || 'Owner Finance'),
          ownerFinanceVerified: !isDistressed,
          agentConfirmedOwnerfinance: !isDistressed,
          ...(isDistressed && { agentConfirmedDistressedCashOnly: true }),
          ...(isCashDeal && { agentConfirmedMotivated: true }),

          // Images — populate every alias (primary) + gallery (propertyImages/imageUrls)
          ...(primaryImage && {
            primaryImage,
            firstPropertyImage: primaryImage,
            imgSrc: primaryImage,
            hiResImageLink: property.hiResImageLink || primaryImage,
            mediumImageLink: property.mediumImageLink || primaryImage,
            desktopWebHdpImageLink: property.desktopWebHdpImageLink || primaryImage,
          }),
          ...(gallery && gallery.length > 0 && {
            propertyImages: gallery,
            imageUrls: gallery,
            photoCount: property.photoCount || gallery.length,
          }),

          // Distressed: OF flag must stay false regardless of agent's "YES".
          isOwnerfinance: !isDistressed,
          isCashDeal,
          dealTypes,
          isActive: true,
          ...(latitude != null && longitude != null && { latitude, longitude }),
          source: 'agent_outreach',
          agentConfirmedAt: new Date(),
          agentNote: agentNote || null,
          originalQueueId: firebaseId,
          importedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastStatusCheck: new Date(),
          lastScrapedAt: new Date(),
          rawData: property.rawData || null,
        });
      }

      console.log(`   ✅ ${resolvedVia === 'created' ? 'Created' : 'Flipped'} ${propertyDocId}`);

      // Sync to Typesense for search
      try {
        const propertyDoc = await db.collection('properties').doc(propertyDocId).get();
        if (propertyDoc.exists) {
          await indexRawFirestoreProperty(propertyDocId, propertyDoc.data()!, 'properties');
          console.log('   ✅ Synced to Typesense');
        }
      } catch (typesenseErr: unknown) {
        const errMsg = typesenseErr instanceof Error ? typesenseErr.message : 'Unknown error';
        console.error(`   ⚠️ Typesense sync failed: ${errMsg}`);
      }

      // Update agent_outreach_queue — persist GHL IDs so next webhook for this
      // opportunity resolves directly via ghlOpportunityId without fallback.
      // lastProcessedOpportunityId is the idempotency key for future retries.
      await docRef.update({
        status: 'agent_yes',
        agentResponse: 'yes',
        agentResponseAt: new Date(),
        agentNote: agentNote || null,
        routedTo: 'properties',
        routedToDocId: propertyDocId,
        resolvedVia,
        ...(ghlOpportunityId ? { lastProcessedOpportunityId: ghlOpportunityId } : {}),
        ...(ghlOpportunityId && !property.ghlOpportunityId ? { ghlOpportunityId } : {}),
        ...(ghlContactId && !property.ghlContactId ? { ghlContactId } : {}),
        updatedAt: new Date(),
      });

    } else {
      // Agent said NO — seller/agent reversed. The property must stop
      // displaying as owner-finance anywhere.
      console.log('❌ [AGENT RESPONSE WEBHOOK] Agent said NO');

      // Resolve the property doc (same zpid-then-address fallback as YES path).
      const normAddr = (s: string) => String(s || '').toLowerCase().trim().replace(/[#,\.]/g, '').replace(/\s+/g, ' ');
      let propertyDocId = `zpid_${property.zpid}`;
      let propSnap = await db.collection('properties').doc(propertyDocId).get();
      if (!propSnap.exists && property.address && property.city && property.state) {
        const target = normAddr(property.address);
        const addrSnap = await db.collection('properties')
          .where('city', '==', property.city)
          .where('state', '==', property.state)
          .get();
        for (const d of addrSnap.docs) {
          const dAddr = normAddr(d.data().address || d.data().streetAddress || '');
          if (dAddr && dAddr === target) {
            propertyDocId = d.id;
            propSnap = d;
            break;
          }
        }
      }

      // Agent NO means: strip OF signal, hide from site, but KEEP the
      // Firestore doc. The status-checker cron owns hard-delete when it
      // eventually sees SOLD/CLOSED/OFF_MARKET on Zillow.
      let action: 'none' | 'strip_and_hide' = 'none';
      if (propSnap.exists) {
        const existing = propSnap.data()!;
        const dealTypes: string[] = Array.isArray(existing.dealTypes) ? existing.dealTypes : [];
        const nextDealTypes = dealTypes.filter((t: string) => t !== 'owner_finance');
        await db.collection('properties').doc(propertyDocId).set({
          isOwnerfinance: false,
          agentConfirmedOwnerfinance: false,
          ownerFinanceVerified: false,
          dealTypes: nextDealTypes,
          isActive: false,
          agentReversedAt: new Date(),
          lastStatusCheck: new Date(),
        }, { merge: true });
        // Drop from Typesense so search/site stop surfacing it.
        try {
          const { deletePropertyFromIndex } = await import('@/lib/typesense/sync');
          await deletePropertyFromIndex(propertyDocId);
        } catch (e) { console.error(`   ⚠️ Typesense delete failed:`, e); }
        action = 'strip_and_hide';
        console.log(`   🧹 Stripped OF + hid ${propertyDocId} (source=${existing.source})`);
      }

      await docRef.update({
        status: 'agent_no',
        agentResponse: 'no',
        agentResponseAt: new Date(),
        agentNote: agentNote || null,
        routedTo: 'rejected',
        propertyAction: action,
        routedToDocId: propSnap.exists ? propertyDocId : null,
        ...(ghlOpportunityId ? { lastProcessedOpportunityId: ghlOpportunityId } : {}),
        ...(ghlOpportunityId && !property.ghlOpportunityId ? { ghlOpportunityId } : {}),
        ...(ghlContactId && !property.ghlContactId ? { ghlContactId } : {}),
        updatedAt: new Date(),
      });

      console.log(`   ✅ Marked as rejected (action: ${action})`);
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
