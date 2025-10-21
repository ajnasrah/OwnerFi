import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';

// Initialize Firebase Admin (if not already initialized)
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

// GHL Webhook URL
const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/35223b5b-19d3-4a7d-942a-592249ceb5e7';

export async function POST(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    console.log(`\n🚀 Starting GHL webhook sync\n`);

    // Get optional limit from request body
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;

    // Fetch properties from zillow_imports collection
    const snapshot = await db
      .collection('zillow_imports')
      .orderBy('importedAt', 'desc')
      .limit(limit)
      .get();

    // Filter for properties with agent OR broker phone
    const properties = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((property: any) => property.agentPhoneNumber || property.brokerPhoneNumber);

    console.log(`📊 Found ${properties.length} properties with contact info\n`);

    if (properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties with contact info to send',
        stats: { total: 0, success: 0, errors: 0 },
      });
    }

    // Send each property to GHL webhook
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const property of properties) {
      try {
        const data: any = property;

        // Prepare webhook payload with the exact fields you want
        const webhookData = {
          property_id: data.zpid || data.id || '',
          full_address: data.fullAddress || '',
          street_address: data.streetAddress || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zipCode || '',
          bedrooms: data.bedrooms || 0,
          bathrooms: data.bathrooms || 0,
          square_foot: data.squareFoot || 0,
          building_type: data.buildingType || data.homeType || '',
          year_built: data.yearBuilt || 0,
          lot_square_foot: data.lotSquareFoot || 0,
          estimate: data.estimate || 0,
          hoa: data.hoa || 0,
          description: data.description || '',
          agent_name: data.agentName || '',
          agent_phone_number: data.agentPhoneNumber || data.brokerPhoneNumber || '',
          annual_tax_amount: data.annualTaxAmount || 0,

          // Additional useful fields
          price: data.price || 0,
          zillow_url: data.url || '',
          property_image: data.firstPropertyImage || '',
          broker_name: data.brokerName || '',
          broker_phone: data.brokerPhoneNumber || '',
        };

        console.log(`📤 Sending: ${webhookData.full_address || webhookData.street_address}`);

        // POST to GHL webhook
        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookData),
        });

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
        }

        successCount++;
        console.log(`✅ Success`);

        // Small delay to avoid overwhelming the webhook
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        errorCount++;
        const propertyData: any = property;
        errors.push({
          property: propertyData.fullAddress || propertyData.streetAddress || 'Unknown',
          error: error.message,
        });
        console.error(`❌ Error: ${error.message}`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}\n`);

    return NextResponse.json({
      success: true,
      message: `Sent ${successCount} properties to GHL webhook`,
      stats: {
        total: properties.length,
        success: successCount,
        errors: errorCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('Failed to send properties to GHL webhook:', error);
    return NextResponse.json(
      { error: 'Failed to send properties to GHL', details: error.message },
      { status: 500 }
    );
  }
}
