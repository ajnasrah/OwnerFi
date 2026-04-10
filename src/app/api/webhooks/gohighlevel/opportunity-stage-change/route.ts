import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { indexRawFirestoreProperty, deletePropertyFromIndex } from '@/lib/typesense/sync';

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

/**
 * Webhook: GHL Opportunity Stage Change
 *
 * Called by GHL workflow when an opportunity's stage changes.
 * Supports TWO pipelines:
 *
 * 1. AGENT OUTREACH PIPELINE (firebase_id provided):
 *    Looks up agent_outreach_queue by firebase_id
 *    - "Interested" -> owner finance positive
 *    - "not interested" -> owner finance negative
 *
 * 2. BUYER PIPELINE (phone/email provided, no firebase_id):
 *    Looks up buyerProfiles by phone or email
 *    - "Lost/not int" or "not interested" -> deactivates buyer + voids referral agreements
 *
 * Expected payload from GHL workflow:
 * {
 *   firebase_id?: string,       // Agent pipeline: outreach queue doc ID
 *   phone?: string,             // Buyer pipeline: contact phone number
 *   email?: string,             // Buyer pipeline: contact email
 *   stage: string,              // New stage name
 *   pipeline?: string,          // Pipeline name (optional, for logging)
 *   note?: string,
 *   GHL_WEBHOOK?: string        // Auth secret
 * }
 *
 * URL: /api/webhooks/gohighlevel/opportunity-stage-change
 * Method: POST
 */
export async function POST(request: NextRequest) {
  console.log('[STAGE CHANGE] Received webhook');

  try {
    const body = await request.json();

    // Auth: check secret in body (GHL sends it as custom field in workflow)
    const bodySecret = body['GHL_WEBHOOK'] || body['webhook_secret'] || body['secret'];
    const expectedSecret = process.env.GHL_WEBHOOK_SECRET;

    if (!expectedSecret || !bodySecret || bodySecret.trim() !== expectedSecret.trim()) {
      console.error('[STAGE CHANGE] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseId = body.firebase_id || body.firebaseId;
    const phone = body.phone || body.contact_phone || '';
    const email = body.email || body.contact_email || '';
    const stage = (body.stage || '').trim().toLowerCase();
    const note = body.note || body.agent_note || '';
    const pipeline = (body.pipeline || '').trim().toLowerCase();

    console.log(`[STAGE CHANGE] firebase_id=${firebaseId}, phone=${phone}, stage="${stage}", pipeline="${pipeline}"`);

    if (!stage) {
      return NextResponse.json({ error: 'Missing stage' }, { status: 400 });
    }

    // Map stage to action
    const isNotInterested = stage.includes('not') && (stage.includes('interested') || stage.includes('int'));
    const isLost = stage.includes('lost');
    const isInterested = stage.includes('interested') && !stage.includes('not');

    // --- BUYER PIPELINE: lookup by phone/email ---
    if (!firebaseId && (phone || email)) {
      console.log(`[STAGE CHANGE] No firebase_id — using phone/email lookup (buyer pipeline)`);

      if (!isNotInterested && !isLost) {
        console.log(`[STAGE CHANGE] Stage "${stage}" is not a removal stage for buyer pipeline, skipping`);
        return NextResponse.json({
          success: true,
          message: `Stage "${stage}" does not require buyer removal`,
          skipped: true,
        });
      }

      // Find buyer profile by phone then email
      let buyerDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      let lookupMethod = '';

      if (phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        const phoneFormats = [
          phone,
          `+${cleanPhone}`,
          `+1${cleanPhone.length === 10 ? cleanPhone : cleanPhone.slice(1)}`,
        ];
        for (const fmt of phoneFormats) {
          const snap = await db.collection('buyerProfiles').where('phone', '==', fmt).limit(1).get();
          if (!snap.empty) {
            buyerDoc = snap.docs[0];
            lookupMethod = `phone:${fmt}`;
            break;
          }
        }
      }

      if (!buyerDoc && email) {
        const snap = await db.collection('buyerProfiles').where('email', '==', email.toLowerCase().trim()).limit(1).get();
        if (!snap.empty) {
          buyerDoc = snap.docs[0];
          lookupMethod = 'email';
        }
      }

      if (!buyerDoc) {
        console.log(`[STAGE CHANGE] Buyer not found by phone=${phone} email=${email}`);
        return NextResponse.json({ error: 'Buyer not found', phone, email }, { status: 404 });
      }

      const buyerData = buyerDoc.data();
      const buyerName = `${buyerData.firstName || ''} ${buyerData.lastName || ''}`.trim() || 'Unknown';
      console.log(`[STAGE CHANGE] Found buyer: ${buyerName} (${buyerDoc.id}) via ${lookupMethod}`);

      // Deactivate buyer profile
      await db.collection('buyerProfiles').doc(buyerDoc.id).update({
        isAvailableForPurchase: false,
        isActive: false,
        optedOutAt: new Date(),
        optOutReason: 'not_interested',
        optOutSource: 'ghl_stage_change',
        updatedAt: new Date(),
      });

      console.log(`[STAGE CHANGE] Deactivated buyer ${buyerDoc.id}`);

      // Void all active referral agreements for this buyer
      let voidedAgreements = 0;
      const agreementsSnap = await db.collection('referralAgreements')
        .where('buyerId', '==', buyerDoc.id)
        .where('status', 'in', ['pending', 'signed'])
        .get();

      if (!agreementsSnap.empty) {
        const batch = db.batch();
        for (const agDoc of agreementsSnap.docs) {
          batch.update(agDoc.ref, {
            status: 'voided',
            voidedAt: new Date(),
            voidReason: 'Buyer marked not interested via GHL stage change',
            voidSource: 'ghl_stage_change',
            updatedAt: new Date(),
          });
        }
        await batch.commit();
        voidedAgreements = agreementsSnap.size;
        console.log(`[STAGE CHANGE] Voided ${voidedAgreements} referral agreement(s)`);
      }

      return NextResponse.json({
        success: true,
        action: 'buyer_not_interested',
        buyerId: buyerDoc.id,
        buyerName,
        lookupMethod,
        voidedAgreements,
      });
    }

    // --- AGENT OUTREACH PIPELINE: lookup by firebase_id ---
    if (!firebaseId) {
      return NextResponse.json({ error: 'Missing firebase_id and phone/email' }, { status: 400 });
    }

    // Look up the queue document
    const queueRef = db.collection('agent_outreach_queue').doc(firebaseId);
    const queueDoc = await queueRef.get();

    if (!queueDoc.exists) {
      console.error(`[STAGE CHANGE] Queue doc not found: ${firebaseId}`);
      return NextResponse.json({ error: 'Property not found in queue' }, { status: 404 });
    }

    const property = queueDoc.data()!;
    const zpid = property.zpid;
    const propertyDocId = zpid ? `zpid_${zpid}` : null;

    console.log(`[STAGE CHANGE] Property: ${property.address}, zpid=${zpid}`);

    if (!isInterested && !isNotInterested) {
      console.log(`[STAGE CHANGE] Stage "${stage}" is not actionable, skipping`);
      return NextResponse.json({
        success: true,
        message: `Stage "${stage}" does not require updates`,
        skipped: true,
      });
    }

    if (isInterested) {
      // --- INTERESTED: Owner Finance Positive ---
      console.log('[STAGE CHANGE] -> INTERESTED (owner finance positive)');

      // Update queue
      await queueRef.update({
        status: 'agent_yes',
        agentResponse: 'yes',
        agentResponseAt: new Date(),
        agentNote: note || null,
        routedTo: 'properties',
        updatedAt: new Date(),
      });

      // Update or create property
      if (propertyDocId) {
        const propRef = db.collection('properties').doc(propertyDocId);
        const propDoc = await propRef.get();

        if (propDoc.exists) {
          await propRef.update({
            ownerFinanceVerified: true,
            agentConfirmedOwnerfinance: true,
            isOwnerfinance: true,
            agentConfirmedAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          // Create property from queue data
          const descriptionText = sanitizeDescription(property.rawData?.description || '');

          let financingTypeResult = { financingType: 'Owner Finance', allTypes: ['Owner Finance'], displayLabel: 'Owner Finance' };
          try {
            const { detectFinancingType } = await import('@/lib/financing-type-detector');
            financingTypeResult = detectFinancingType(descriptionText);
          } catch (_e) { /* use defaults */ }

          await propRef.set({
            zpid: property.zpid,
            url: property.url,
            address: property.address || '',
            streetAddress: property.address || '',
            fullAddress: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
            city: property.city || '',
            state: property.state || '',
            zipCode: property.zipCode || '',
            price: property.price || 0,
            listPrice: property.price || 0,
            zestimate: property.zestimate || null,
            priceToZestimateRatio: property.priceToZestimateRatio || 0,
            bedrooms: property.beds || 0,
            bathrooms: property.baths || 0,
            squareFoot: property.squareFeet || 0,
            homeType: property.propertyType || 'SINGLE_FAMILY',
            homeStatus: 'FOR_SALE',
            agentName: property.agentName,
            agentPhoneNumber: property.agentPhone,
            agentEmail: property.agentEmail || null,
            description: descriptionText,
            imgSrc: property.rawData?.hiResImageLink || property.rawData?.imgSrc || null,
            financingType: financingTypeResult.financingType || 'Owner Finance',
            allFinancingTypes: financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance'],
            financingTypeLabel: financingTypeResult.displayLabel || 'Owner Finance',
            ownerFinanceVerified: true,
            agentConfirmedOwnerfinance: true,
            isOwnerfinance: true,
            isCashDeal: false,
            dealTypes: ['owner_finance'],
            isActive: true,
            source: 'agent_outreach',
            agentConfirmedAt: new Date(),
            originalQueueId: firebaseId,
            importedAt: new Date(),
            createdAt: new Date(),
            rawData: property.rawData || null,
          });
          console.log(`[STAGE CHANGE] Created property ${propertyDocId}`);
        }

        // Sync to Typesense
        try {
          const freshDoc = await propRef.get();
          if (freshDoc.exists) {
            await indexRawFirestoreProperty(propertyDocId, freshDoc.data()!, 'properties');
            console.log(`[STAGE CHANGE] Synced to Typesense`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown';
          console.error(`[STAGE CHANGE] Typesense sync failed: ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        action: 'owner_finance_positive',
        firebaseId,
        address: property.address,
      });

    } else {
      // --- NOT INTERESTED: Owner Finance Negative ---
      console.log('[STAGE CHANGE] -> NOT INTERESTED (owner finance negative)');

      // Update queue
      await queueRef.update({
        status: 'agent_no',
        agentResponse: 'no',
        agentResponseAt: new Date(),
        agentNote: note || 'Marked not interested via GHL stage change',
        routedTo: 'rejected',
        updatedAt: new Date(),
      });

      // Update property if it exists
      if (propertyDocId) {
        const propRef = db.collection('properties').doc(propertyDocId);
        const propDoc = await propRef.get();

        if (propDoc.exists) {
          await propRef.update({
            ownerFinanceVerified: false,
            agentConfirmedOwnerfinance: false,
            agentRejectedAt: new Date(),
            agentRejectionNote: note || 'Marked not interested via GHL stage change',
            updatedAt: new Date(),
          });

          // Remove from Typesense
          try {
            await deletePropertyFromIndex(propertyDocId);
            console.log(`[STAGE CHANGE] Removed from Typesense`);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown';
            console.error(`[STAGE CHANGE] Typesense deletion failed: ${msg}`);
          }
        }
      }

      return NextResponse.json({
        success: true,
        action: 'owner_finance_negative',
        firebaseId,
        address: property.address,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STAGE CHANGE] Error:', msg);
    return NextResponse.json({ error: 'Internal server error', message: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    webhook: 'opportunity-stage-change',
    method: 'POST',
    description: 'Handles GHL opportunity stage changes for both agent outreach and buyer pipelines',
    payload: {
      firebase_id: 'string (optional) - agent_outreach_queue doc ID (agent pipeline)',
      phone: 'string (optional) - contact phone for buyer pipeline lookup',
      email: 'string (optional) - contact email for buyer pipeline lookup',
      stage: 'string (required) - new stage name',
      GHL_WEBHOOK: 'string (required) - auth secret',
      note: 'string (optional)',
    },
    lookup: {
      'agent_pipeline': 'Uses firebase_id to look up agent_outreach_queue',
      'buyer_pipeline': 'Uses phone/email to look up buyerProfiles (when no firebase_id)',
    },
    stages: {
      'Interested': 'Agent pipeline: sets ownerFinanceVerified=true, creates property',
      'not interested / Lost/not int': 'Agent pipeline: rejects property. Buyer pipeline: deactivates buyer + voids referral agreements',
    },
  });
}
