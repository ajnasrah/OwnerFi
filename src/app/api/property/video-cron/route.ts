// Property Video Cron Job
// Automatically finds eligible properties and generates videos
// Runs 3x daily: 11 AM, 5 PM, 11 PM EST

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { isEligibleForVideo } from '@/lib/property-video-generator';
import type { PropertyListing } from '@/lib/property-schema';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_VIDEOS_PER_RUN = 3;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');

    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isFromDashboard && !hasValidSecret && !isVercelCron) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🏡 Property video cron job triggered');

    // Get properties that are eligible and haven't had videos generated
    const propertiesSnapshot = await admin
      .firestore()
      .collection('properties')
      .where('status', '==', 'active')
      .where('isActive', '==', true)
      .where('downPaymentAmount', '<', 15000)
      .orderBy('downPaymentAmount', 'asc') // Prioritize lowest down payment
      .orderBy('dateAdded', 'desc') // Then newest properties
      .limit(20) // Get top 20 to filter from
      .get();

    if (propertiesSnapshot.empty) {
      console.log('⏭️  No eligible properties found');
      return NextResponse.json({
        success: true,
        message: 'No eligible properties found',
        generated: 0
      });
    }

    console.log(`📋 Found ${propertiesSnapshot.size} potential properties`);

    // Filter to properties that don't have videos yet
    const eligibleProperties: PropertyListing[] = [];

    for (const doc of propertiesSnapshot.docs) {
      const property = { id: doc.id, ...doc.data() } as PropertyListing;

      // Check if eligible
      if (!isEligibleForVideo(property)) {
        continue;
      }

      // Check if video already exists
      const existingVideo = await admin
        .firestore()
        .collection('property_videos')
        .where('propertyId', '==', property.id)
        .limit(1)
        .get();

      if (existingVideo.empty) {
        eligibleProperties.push(property);
      }
    }

    console.log(`✅ ${eligibleProperties.length} properties eligible for videos`);

    if (eligibleProperties.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new properties need videos',
        generated: 0
      });
    }

    // Generate videos for top properties (limit per run)
    const propertiesToProcess = eligibleProperties.slice(0, MAX_VIDEOS_PER_RUN);
    const results = [];

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    for (const property of propertiesToProcess) {
      console.log(`\n🎥 Generating video for ${property.address}`);

      try {
        // Call the generate-video API
        const response = await fetch(`${baseUrl}/api/property/generate-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            propertyId: property.id
          })
        });

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Video generation started for ${property.address}`);
          results.push({
            propertyId: property.id,
            address: property.address,
            success: true,
            workflowId: result.workflowId
          });
        } else {
          console.error(`❌ Failed to generate video for ${property.address}:`, result.error);
          results.push({
            propertyId: property.id,
            address: property.address,
            success: false,
            error: result.error
          });
        }

        // Wait 2 seconds between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error generating video for ${property.address}:`, error);
        results.push({
          propertyId: property.id,
          address: property.address,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`\n📊 Property video cron summary:`);
    console.log(`   Eligible properties: ${eligibleProperties.length}`);
    console.log(`   Videos generated: ${successCount}/${propertiesToProcess.length}`);

    return NextResponse.json({
      success: true,
      generated: successCount,
      total: propertiesToProcess.length,
      eligible: eligibleProperties.length,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Property video cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
