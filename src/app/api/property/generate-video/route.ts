// Property Video Generation API
// Generates HeyGen videos for owner-financed properties

import { NextRequest, NextResponse } from 'next/server';
import { generatePropertyVideo } from '@/lib/property-video-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, variant = '30' } = body; // Default to 30-sec variant

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'Property ID required' },
        { status: 400 }
      );
    }

    // Call shared service
    const result = await generatePropertyVideo(propertyId, variant);

    // Return appropriate status code
    const statusCode = result.success ? 200 :
                      result.error === 'Property not found' ? 404 :
                      result.error === 'Property not eligible' || result.error === 'Invalid property data' ? 400 :
                      500;

    return NextResponse.json(result, { status: statusCode });

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
