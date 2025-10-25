// Property Video Generation API
// Generates HeyGen videos for owner-financed properties

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import {
  generatePropertyScript,
  isEligibleForVideo,
  validatePropertyForVideo,
  buildPropertyVideoRequest
} from '@/lib/property-video-generator';
import type { PropertyListing } from '@/lib/property-schema';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'Property ID required' },
        { status: 400 }
      );
    }

    console.log(`🏡 Generating video for property: ${propertyId}`);

    // Get property from Firestore
    const propertyDoc = await admin
      .firestore()
      .collection('properties')
      .doc(propertyId)
      .get();

    if (!propertyDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    const property = { id: propertyDoc.id, ...propertyDoc.data() } as PropertyListing;

    // Check eligibility
    if (!isEligibleForVideo(property)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Property not eligible',
          reason: 'Must be active with <$15k down and have images'
        },
        { status: 400 }
      );
    }

    // Validate property data
    const validation = validatePropertyForVideo(property);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid property data',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Generate script
    const { script, caption, title, hashtags } = generatePropertyScript(property);

    console.log(`📝 Generated script for ${property.address}`);
    console.log(`   Script length: ${script.length} chars`);
    console.log(`   Title: ${title}`);

    // Create workflow record
    const workflowId = `property_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const workflowData = {
      id: workflowId,
      propertyId: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      downPayment: property.downPaymentAmount,
      monthlyPayment: property.monthlyPayment,
      script,
      caption: caption + '\n\n' + hashtags.map(h => `#${h}`).join(' '),
      title,
      status: 'heygen_processing' as const,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await admin
      .firestore()
      .collection('property_videos')
      .doc(workflowId)
      .set(workflowData);

    console.log(`✅ Created workflow: ${workflowId}`);

    // Check HeyGen API key
    if (!HEYGEN_API_KEY) {
      throw new Error('HeyGen API key not configured');
    }

    // Build HeyGen request
    const heygenRequest = buildPropertyVideoRequest(property, script);

    // Add webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
    const webhookUrl = `${baseUrl}/api/webhooks/heygen/property`;

    const requestBody = {
      ...heygenRequest,
      callback_id: workflowId
    };

    console.log(`🎥 Sending request to HeyGen...`);

    // Call HeyGen API
    const response = await fetch(HEYGEN_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HeyGen API error:', errorText);
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const heygenResult = await response.json();

    if (heygenResult.error) {
      throw new Error(`HeyGen error: ${JSON.stringify(heygenResult.error)}`);
    }

    const videoId = heygenResult.data?.video_id;
    if (!videoId) {
      throw new Error('HeyGen did not return video ID');
    }

    // Update workflow with HeyGen video ID
    await admin
      .firestore()
      .collection('property_videos')
      .doc(workflowId)
      .update({
        heygenVideoId: videoId,
        updatedAt: Date.now()
      });

    console.log(`✅ Property video generation started!`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Workflow ID: ${workflowId}`);

    return NextResponse.json({
      success: true,
      workflowId,
      videoId,
      property: {
        id: property.id,
        address: property.address,
        city: property.city,
        state: property.state
      },
      message: 'Property video generation started. Will be processed via webhooks.'
    });

  } catch (error) {
    console.error('❌ Property video generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
