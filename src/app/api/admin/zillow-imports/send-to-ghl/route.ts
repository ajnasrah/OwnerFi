import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { filterPropertiesForOwnerFinancing, getFilterExplanation } from '@/lib/owner-financing-filter';

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
const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/2be65188-9b2e-43f1-a9d8-33d9907b375c';

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

    // Get optional limit and force resend from request body
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;
    const forceResend = body.forceResend || false; // Admin can force resend

    console.log(`🔍 Fetching properties (limit: ${limit}, forceResend: ${forceResend})\n`);

    // Fetch properties from zillow_imports collection
    // Only get properties that haven't been sent (unless forceResend is true)
    let queryBuilder = db.collection('zillow_imports').orderBy('importedAt', 'desc');

    if (!forceResend) {
      // Exclude already sent properties
      queryBuilder = queryBuilder.where('sentToGHL', '!=', true) as any;
    }

    const snapshot = await queryBuilder
      .limit(limit * 3) // Get extra to account for filtering
      .get();

    // Filter for properties with agent OR broker phone
    const propertiesWithContact = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((property: any) => property.agentPhoneNumber || property.brokerPhoneNumber);

    console.log(`📊 Found ${propertiesWithContact.length} properties with contact info (from ${snapshot.size} total)`);

    // OWNER FINANCING FILTER
    // Only send properties that mention owner financing in their description
    const { filtered: allProperties, stats: filterStats } = filterPropertiesForOwnerFinancing(
      propertiesWithContact
    );

    console.log(`\n🏦 OWNER FINANCING FILTER:`);
    console.log(`   Before: ${filterStats.total} properties`);
    console.log(`   ✅ With owner financing: ${filterStats.withOwnerFinancing}`);
    console.log(`   ❌ Without owner financing: ${filterStats.withoutOwnerFinancing}`);
    console.log(`   📝 No description: ${filterStats.noDescription}`);
    console.log(`   🚫 Explicitly rejected: ${filterStats.explicitlyRejected}`);
    console.log(`   After: ${allProperties.length} properties\n`);

    // DEDUPLICATION LOGIC
    // 1. Deduplicate by ZPID (same property)
    const zpidMap = new Map();
    for (const property of allProperties) {
      const zpid = String((property as any).zpid);
      if (!zpid || zpid === '0') continue;

      // Keep the most recently imported version
      const existing = zpidMap.get(zpid);
      if (!existing || (property as any).importedAt > existing.importedAt) {
        zpidMap.set(zpid, property);
      }
    }

    // 2. Deduplicate by contact phone (same agent/broker)
    const contactMap = new Map();
    for (const property of zpidMap.values()) {
      const phone = (property as any).agentPhoneNumber || (property as any).brokerPhoneNumber;
      const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits

      if (!contactMap.has(cleanPhone)) {
        contactMap.set(cleanPhone, []);
      }
      contactMap.get(cleanPhone).push(property);
    }

    // For each contact, only send up to 3 properties (their best listings)
    const properties: any[] = [];
    let contactsProcessed = 0;
    let propertiesSkipped = 0;

    for (const [phone, contactProperties] of contactMap.entries()) {
      contactsProcessed++;

      // Sort by estimate (highest first) and take top 3
      const sorted = contactProperties.sort((a: any, b: any) =>
        (b.estimate || b.price || 0) - (a.estimate || a.price || 0)
      );

      const toSend = sorted.slice(0, 3);
      const skipped = sorted.length - toSend.length;

      properties.push(...toSend);
      propertiesSkipped += skipped;

      if (skipped > 0) {
        console.log(`   📞 Contact ${phone.slice(-4)}: Sending ${toSend.length}, skipping ${skipped} lower-value properties`);
      }
    }

    // Apply final limit
    const limitedProperties = properties.slice(0, limit);

    console.log(`\n✅ DEDUPLICATION COMPLETE:`);
    console.log(`   Total fetched: ${allProperties.length}`);
    console.log(`   After ZPID dedup: ${zpidMap.size}`);
    console.log(`   Unique contacts: ${contactsProcessed}`);
    console.log(`   Properties skipped (>3 per contact): ${propertiesSkipped}`);
    console.log(`   Final properties to send: ${limitedProperties.length}\n`);

    if (limitedProperties.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties to send (all already sent or no contact info)',
        stats: { total: 0, success: 0, errors: 0 },
      });
    }

    // Send each property to GHL webhook
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const property of limitedProperties) {
      try {
        const data: any = property;

        // Prepare webhook payload with the exact fields you want
        const webhookData = {
          firebase_id: data.id || '',
          property_id: data.zpid || '',
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
          rent_estimate: data.rentZestimate || 0,
          hoa: data.hoa || 0,
          description: sanitizeDescription(data.description), // Clean description for GHL
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

        // Mark as sent to prevent re-sending
        try {
          await db.collection('zillow_imports').doc(data.id).update({
            sentToGHL: true,
            sentToGHLAt: new Date(),
            sentToGHLBy: session.user.id,
          });
        } catch (updateError) {
          console.warn(`⚠️  Failed to mark as sent: ${data.id}`);
        }

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
        totalWithContact: filterStats.total,
        ownerFinancingFilter: {
          withFinancing: filterStats.withOwnerFinancing,
          withoutFinancing: filterStats.withoutOwnerFinancing,
          noDescription: filterStats.noDescription,
          explicitlyRejected: filterStats.explicitlyRejected,
          successRate: `${((filterStats.withOwnerFinancing / filterStats.total) * 100).toFixed(1)}%`,
        },
        afterZPIDDedup: zpidMap.size,
        uniqueContacts: contactsProcessed,
        propertiesSkipped: propertiesSkipped,
        sent: successCount,
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
