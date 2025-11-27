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

const GHL_WEBHOOK_URL = process.env.GHL_PROPERTY_SEND_WEBHOOK_URL ||
  process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL ||
  '';

/**
 * Send selected properties to GHL webhook
 *
 * POST /api/admin/properties/send-to-ghl
 * Body: { propertyIds: string[] }
 */
export async function POST(request: NextRequest) {
  console.log('📤 [SEND TO GHL] Starting...');

  try {
    const body = await request.json();
    const { propertyIds } = body;

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return NextResponse.json(
        { error: 'No property IDs provided' },
        { status: 400 }
      );
    }

    if (!GHL_WEBHOOK_URL) {
      return NextResponse.json(
        { error: 'GHL webhook URL not configured' },
        { status: 500 }
      );
    }

    console.log(`📋 [SEND TO GHL] Processing ${propertyIds.length} properties`);

    // Fetch properties from Firestore
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as { id: string; error: string }[],
    };

    for (const propertyId of propertyIds) {
      try {
        // Try zillow_imports first, then properties collection
        let doc = await db.collection('zillow_imports').doc(propertyId).get();

        if (!doc.exists) {
          doc = await db.collection('properties').doc(propertyId).get();
        }

        if (!doc.exists) {
          results.failed++;
          results.errors.push({ id: propertyId, error: 'Property not found' });
          continue;
        }

        const property = doc.data()!;

        // Build GHL payload
        const ghlPayload = {
          // Property identifiers
          firebaseId: doc.id,
          zpid: property.zpid || null,
          zillowUrl: property.url || property.zillowUrl || null,

          // Address
          propertyAddress: property.address || property.streetAddress || '',
          propertyCity: property.city || '',
          propertyState: property.state || '',
          propertyZip: property.zipCode || property.zipcode || '',
          fullAddress: property.fullAddress ||
            `${property.address || ''}, ${property.city || ''}, ${property.state || ''} ${property.zipCode || ''}`,

          // Pricing
          propertyPrice: property.listPrice || property.price || 0,
          propertyZestimate: property.zestimate || property.estimatedValue || null,

          // Details
          propertyBeds: property.bedrooms || property.beds || 0,
          propertyBaths: property.bathrooms || property.baths || 0,
          propertySquareFeet: property.squareFeet || property.livingArea || property.squareFoot || 0,
          propertyType: property.homeType || property.propertyType || 'SINGLE_FAMILY',

          // Financing info
          financingType: property.financingType || 'Owner Finance',
          downPayment: property.downPaymentAmount || null,
          monthlyPayment: property.monthlyPayment || null,

          // Agent info (if available)
          agentName: property.agentName || null,
          agentPhone: property.agentPhoneNumber || property.agentPhone || null,
          agentEmail: property.agentEmail || null,

          // Metadata
          source: 'admin_bulk_send',
          sentAt: new Date().toISOString(),
        };

        console.log(`   📤 Sending: ${ghlPayload.propertyAddress}`);

        // Send to GHL
        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ghlPayload),
        });

        if (!response.ok) {
          throw new Error(`GHL returned ${response.status}`);
        }

        results.sent++;
        console.log(`   ✅ Sent: ${ghlPayload.propertyAddress}`);

      } catch (error: any) {
        results.failed++;
        results.errors.push({ id: propertyId, error: error.message });
        console.error(`   ❌ Failed ${propertyId}:`, error.message);
      }
    }

    console.log(`\n✅ [SEND TO GHL] Complete: ${results.sent} sent, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });

  } catch (error: any) {
    console.error('❌ [SEND TO GHL] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
