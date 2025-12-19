import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { transformProperty } from '@/lib/scraper-v2/property-transformer';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';

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

/**
 * Manual Property Upload API
 *
 * Scrapes a single Zillow property and adds it to database
 * - Bypasses filters (manually verified by outreach team)
 * - Marks as "manuallyVerified: true"
 * - Adds to unified 'properties' collection
 */
export async function POST(request: NextRequest) {
  try {
    const { zillowUrl } = await request.json();

    // Validate URL
    if (!zillowUrl || !zillowUrl.includes('zillow.com')) {
      return NextResponse.json(
        { error: 'Invalid Zillow URL' },
        { status: 400 }
      );
    }

    console.log(`📥 Manual upload requested for: ${zillowUrl}`);

    // Check if property already exists in unified properties collection
    const urlSnapshot = await db.collection('properties')
      .where('url', '==', zillowUrl)
      .limit(1)
      .get();

    if (!urlSnapshot.empty) {
      const existingProperty = urlSnapshot.docs[0].data();
      return NextResponse.json(
        {
          error: 'Property already exists in database',
          property: existingProperty
        },
        { status: 409 }
      );
    }

    // Initialize Apify client
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Apify API key not configured' },
        { status: 500 }
      );
    }

    const client = new ApifyClient({ token: apiKey });

    console.log('🚀 Starting Apify scrape...');

    // Scrape property details
    const input = {
      startUrls: [{ url: zillowUrl }],
      maxResults: 1,
    };

    const run = await client.actor('maxcopell/zillow-detail-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Failed to scrape property details from Zillow' },
        { status: 404 }
      );
    }

    const apifyData = items[0];
    console.log('✅ Property scraped successfully');

    // Transform property data using v2 transformer
    const propertyData = transformProperty(apifyData as any, 'manual-upload', 'manual');

    // Detect financing type from description
    const { detectFinancingType } = await import('@/lib/financing-type-detector');
    const financingTypeResult = detectFinancingType(propertyData.description);

    // Add manual verification flags and unified collection structure
    const enhancedPropertyData = {
      ...propertyData,

      // UNIFIED COLLECTION FIELDS - Required for unified properties collection
      dealTypes: ['owner_finance'], // Manual uploads are owner finance by default
      isOwnerFinance: true,
      isCashDeal: false, // Can be upgraded later if qualifies
      isActive: true,

      // Financing Type Status (based on keyword detection)
      financingType: financingTypeResult.financingType || 'Owner Finance', // Default to Owner Finance for manual uploads
      allFinancingTypes: financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance'],
      financingTypeLabel: financingTypeResult.displayLabel || 'Owner Finance',

      // Manual verification metadata
      manuallyVerified: true,
      verifiedBy: 'outreach-team',
      verifiedAt: new Date(),
      verificationSource: 'agent-confirmed',
      verificationNotes: 'Agent confirmed seller will do owner financing',

      // Bypass filter flags
      bypassedFilter: true,
      filterBypassReason: 'manually-verified-by-outreach',

      // Override owner financing verification
      ownerFinanceVerified: true,
      ownerFinancingAvailable: true,

      // Source tracking
      source: 'manual-upload',
      importMethod: 'admin-manual-upload',

      // Status for admin panel visibility
      status: 'active',

      // Timestamps
      foundAt: new Date(),
      addedToDatabase: new Date(),
      importedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate required fields
    if (!enhancedPropertyData.zpid && !enhancedPropertyData.fullAddress) {
      return NextResponse.json(
        { error: 'Property missing required fields (zpid or address)' },
        { status: 400 }
      );
    }

    // Add to unified properties collection
    // Use zpid_ prefix for document ID to match migration pattern
    const docId = enhancedPropertyData.zpid
      ? `zpid_${String(enhancedPropertyData.zpid)}`
      : `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.collection('properties').doc(docId).set(enhancedPropertyData);

    console.log(`✅ Property added to database: ${docId}`);

    // Sync to Typesense for fast search
    try {
      await indexRawFirestoreProperty(docId, enhancedPropertyData, 'properties');
      console.log(`✅ Property synced to Typesense: ${docId}`);
    } catch (typesenseError) {
      console.warn(`⚠️ Typesense sync failed (property still saved to Firestore):`, typesenseError);
    }

    // Return success with property data
    return NextResponse.json({
      success: true,
      property: {
        id: docId,
        ...enhancedPropertyData,
      },
      message: 'Property added successfully',
    });

  } catch (error) {
    console.error('❌ Manual upload error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to upload property',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if a property exists
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zillowUrl = searchParams.get('url');

    if (!zillowUrl) {
      return NextResponse.json(
        { error: 'Missing URL parameter' },
        { status: 400 }
      );
    }

    // Check if property exists in unified collection
    const snapshot = await db.collection('properties')
      .where('url', '==', zillowUrl)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        exists: false,
        message: 'Property not in database',
      });
    }

    const property = snapshot.docs[0].data();
    return NextResponse.json({
      exists: true,
      property,
      isManuallyVerified: property.manuallyVerified || false,
      isOwnerFinance: property.isOwnerFinance || false,
      isCashDeal: property.isCashDeal || false,
    });

  } catch (error) {
    console.error('❌ Check error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
