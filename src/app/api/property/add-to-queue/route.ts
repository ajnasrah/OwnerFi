// Auto-Add Property to Rotation Queue
// Called when new properties are added/updated in Firestore
// Can be triggered via webhook or direct API call

import { NextRequest, NextResponse } from 'next/server';
import { addPropertyToShowcaseQueue, getPropertyQueueStats } from '@/lib/property-workflow';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');

    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${WEBHOOK_SECRET}`;

    if (!isFromDashboard && !hasValidSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { propertyId, propertyIds } = body;

    if (!propertyId && !propertyIds) {
      return NextResponse.json(
        { error: 'propertyId or propertyIds required' },
        { status: 400 }
      );
    }

    console.log('🏡 Auto-add property to queue triggered');

    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }

    const results = {
      added: 0,
      skipped: 0,
      errors: [] as string[],
      properties: [] as any[]
    };

    // Handle single property
    const idsToProcess = propertyIds || [propertyId];

    for (const id of idsToProcess) {
      try {
        // Get property data
        const propertyDoc = await getDoc(doc(db, 'properties', id));

        if (!propertyDoc.exists()) {
          console.log(`⚠️  Property ${id} not found`);
          results.errors.push(`Property ${id} not found`);
          continue;
        }

        const property = propertyDoc.data();

        // Check eligibility
        if (property.status !== 'active' || property.isActive !== true) {
          console.log(`⏭️  Skipped ${property.address} - not active`);
          results.skipped++;
          continue;
        }

        if (!property.imageUrls || property.imageUrls.length === 0) {
          console.log(`⏭️  Skipped ${property.address} - no images`);
          results.skipped++;
          continue;
        }

        // Add to queue (NEW system)
        await addPropertyToShowcaseQueue(id, {
          address: property.address,
          city: property.city,
          state: property.state,
          downPayment: property.downPaymentAmount,
          monthlyPayment: property.monthlyPayment
        });

        console.log(`✅ Added to queue: ${property.address}`);
        results.added++;
        results.properties.push({
          id,
          address: property.address,
          city: property.city,
          state: property.state
        });

      } catch (error) {
        if (error.message?.includes('already in queue')) {
          console.log(`⏭️  Property ${id} already in queue`);
          results.skipped++;
        } else {
          console.error(`❌ Error adding property ${id}:`, error);
          results.errors.push(`${id}: ${error.message}`);
        }
      }
    }

    // Get updated stats (NEW system)
    const stats = await getPropertyQueueStats();

    console.log(`\n📊 Auto-add complete:`);
    console.log(`   Added: ${results.added}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Errors: ${results.errors.length}`);
    console.log(`   Total in queue: ${stats.total}`);

    return NextResponse.json({
      success: true,
      added: results.added,
      skipped: results.skipped,
      errors: results.errors,
      properties: results.properties,
      queueStats: {
        total: stats.total,
        queued: stats.queued,
        processing: stats.processing
      },
      message: results.added > 0
        ? `Added ${results.added} ${results.added === 1 ? 'property' : 'properties'} to queue`
        : 'No properties added'
    });

  } catch (error) {
    console.error('❌ Error in auto-add endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check what would be added
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({
        error: 'propertyId query parameter required'
      }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }

    // Get property data
    const propertyDoc = await getDoc(doc(db, 'properties', propertyId));

    if (!propertyDoc.exists()) {
      return NextResponse.json({
        eligible: false,
        reason: 'Property not found'
      });
    }

    const property = propertyDoc.data();

    // Check eligibility
    const checks = {
      exists: true,
      isActive: property.status === 'active' && property.isActive === true,
      hasImages: property.imageUrls && property.imageUrls.length > 0,
    };

    const eligible = checks.isActive && checks.hasImages;

    return NextResponse.json({
      eligible,
      checks,
      property: {
        id: propertyId,
        address: property.address,
        city: property.city,
        state: property.state,
        status: property.status,
        isActive: property.isActive,
        imageCount: property.imageUrls?.length || 0
      },
      message: eligible
        ? 'Property is eligible for queue'
        : 'Property is not eligible'
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
