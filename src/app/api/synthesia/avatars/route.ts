/**
 * Synthesia Avatars Admin Endpoint
 *
 * GET /api/synthesia/avatars — List available Synthesia avatars
 * GET /api/synthesia/avatars?voices=true — Also include available voices
 *
 * Used to browse Synthesia's avatar library for agent configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSynthesiaAvatars, getSynthesiaVoices } from '@/lib/synthesia-client';

export async function GET(request: NextRequest) {
  try {
    const includeVoices = request.nextUrl.searchParams.get('voices') === 'true';

    console.log('Fetching Synthesia avatars...');
    const avatars = await getSynthesiaAvatars();

    const result: any = {
      success: true,
      avatarCount: avatars.length,
      avatars,
    };

    if (includeVoices) {
      console.log('Fetching Synthesia voices...');
      const voices = await getSynthesiaVoices();
      result.voiceCount = voices.length;
      result.voices = voices;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching Synthesia avatars:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Synthesia avatars',
      },
      { status: 500 }
    );
  }
}
