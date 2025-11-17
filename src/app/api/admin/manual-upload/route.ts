import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { transformApifyProperty } from '@/lib/property-transform';

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
 * - Adds to zillow_imports collection
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

    // Check if property already exists
    const urlSnapshot = await db.collection('zillow_imports')
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

    // Transform property data
    const propertyData = transformApifyProperty(apifyData, 'manual-upload');

    // Add manual verification flags
    const enhancedPropertyData = {
      ...propertyData,

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

      // Timestamps
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

    // Add to database
    const docId = enhancedPropertyData.zpid
      ? String(enhancedPropertyData.zpid)
      : db.collection('zillow_imports').doc().id;

    await db.collection('zillow_imports').doc(docId).set(enhancedPropertyData);

    console.log(`✅ Property added to database: ${docId}`);

    // Return success with property data
    return NextResponse.json({
      success: true,
      property: {
        id: docId,
        ...enhancedPropertyData,
      },
      message: 'Property added successfully',
    });

  } catch (error: any) {
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

    // Check if property exists
    const snapshot = await db.collection('zillow_imports')
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
    });

  } catch (error: any) {
    console.error('❌ Check error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
