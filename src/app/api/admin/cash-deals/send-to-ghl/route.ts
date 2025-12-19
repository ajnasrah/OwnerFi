import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const GHL_WEBHOOK_URL = process.env.GHL_CASH_DEAL_WEBHOOK_URL ||
  process.env.GHL_PROPERTY_SEND_WEBHOOK_URL ||
  process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL ||
  '';

/**
 * Send selected cash deals to GHL webhook
 *
 * POST /api/admin/cash-deals/send-to-ghl
 * Body: { dealIds: string[] }
 */
export async function POST(request: NextRequest) {
  console.log('📤 [CASH DEALS -> GHL] Starting...');

  try {
    const body = await request.json();
    const { dealIds } = body;

    if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
      return NextResponse.json(
        { error: 'No deal IDs provided' },
        { status: 400 }
      );
    }

    if (!GHL_WEBHOOK_URL) {
      return NextResponse.json(
        { error: 'GHL webhook URL not configured' },
        { status: 500 }
      );
    }

    console.log(`📋 [CASH DEALS -> GHL] Processing ${dealIds.length} deals`);

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as { id: string; error: string }[],
      skippedDeals: [] as { id: string; address: string; sentAt: string }[],
    };

    for (const dealId of dealIds) {
      try {
        // Look up in unified properties collection
        const doc = await db.collection('properties').doc(dealId).get();

        if (!doc.exists) {
          results.failed++;
          results.errors.push({ id: dealId, error: 'Deal not found' });
          continue;
        }

        const deal = doc.data()!;

        // Check if already sent to GHL
        if (deal.sentToGHL) {
          results.skipped++;
          results.skippedDeals.push({
            id: dealId,
            address: deal.address || 'Unknown',
            sentAt: deal.sentToGHL,
          });
          console.log(`   ⏭️ Skipped (already sent): ${deal.address || dealId}`);
          continue;
        }

        // Build GHL payload for cash deal
        const ghlPayload = {
          // Deal identifiers
          firebaseId: doc.id,
          zpid: deal.zpid || null,
          zillowUrl: deal.url || deal.zillowUrl || null,

          // Address
          propertyAddress: deal.address || deal.streetAddress || '',
          propertyCity: deal.city || '',
          propertyState: deal.state || '',
          propertyZip: deal.zipCode || deal.zipcode || '',
          fullAddress: `${deal.address || ''}, ${deal.city || ''}, ${deal.state || ''} ${deal.zipCode || deal.zipcode || ''}`,

          // Pricing
          propertyPrice: deal.price || 0,
          propertyArv: deal.arv || null,
          percentOfArv: deal.percentOfArv || null,
          discount: deal.arv && deal.price ? deal.arv - deal.price : null,

          // Details
          propertyBeds: deal.beds || deal.bedrooms || 0,
          propertyBaths: deal.baths || deal.bathrooms || 0,
          propertySquareFeet: deal.sqft || deal.squareFeet || 0,
          propertyType: deal.homeType || deal.propertyType || 'SINGLE_FAMILY',

          // Cash flow data (if available)
          rentEstimate: deal.rentEstimate || null,
          monthlyCashFlow: deal.cashFlow?.monthlyCashFlow || null,
          cocReturn: deal.cashFlow?.cocReturn || null,

          // Deal type
          dealType: deal.ownerFinanceVerified ? 'owner_finance' : 'cash_deal',
          ownerFinanceVerified: deal.ownerFinanceVerified || false,

          // Metadata
          source: 'admin_cash_deals',
          sentAt: new Date().toISOString(),
        };

        console.log(`   📤 Sending: ${ghlPayload.propertyAddress} (${ghlPayload.percentOfArv}% ARV)`);

        // Send to GHL
        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ghlPayload),
        });

        if (!response.ok) {
          throw new Error(`GHL returned ${response.status}`);
        }

        // Mark deal as sent to GHL
        const sentTimestamp = new Date().toISOString();
        await db.collection('properties').doc(dealId).update({
          sentToGHL: sentTimestamp,
        });

        results.sent++;
        console.log(`   ✅ Sent: ${ghlPayload.propertyAddress}`);

      } catch (error) {
        results.failed++;
        results.errors.push({ id: dealId, error: error.message });
        console.error(`   ❌ Failed ${dealId}:`, error.message);
      }
    }

    console.log(`\n✅ [CASH DEALS -> GHL] Complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      skipped: results.skipped,
      skippedDeals: results.skippedDeals.length > 0 ? results.skippedDeals : undefined,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });

  } catch (error) {
    console.error('❌ [CASH DEALS -> GHL] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
