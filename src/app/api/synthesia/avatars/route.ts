/**
 * Synthesia Admin Endpoint
 *
 * GET /api/synthesia/avatars — List recent Synthesia videos (API connectivity check)
 *
 * Note: Synthesia API v2 does NOT have /avatars or /voices endpoints.
 * Avatar IDs are known strings (e.g. "anna_costume1_cameraA").
 * This endpoint serves as an API connectivity check and video list.
 */

import { NextResponse } from 'next/server';
import { apiKeys } from '@/lib/env-config';
import { TIMEOUTS } from '@/config/constants';
import { fetchWithTimeout } from '@/lib/api-utils';

export async function GET() {
  try {
    const key = apiKeys.synthesia;
    if (!key) {
      return NextResponse.json({
        success: false,
        error: 'SYNTHESIA_API_KEY not configured',
      }, { status: 500 });
    }

    const headers = {
      'Authorization': key,
      'Accept': 'application/json',
    };

    // List recent videos as a connectivity check
    const response = await fetchWithTimeout(
      'https://api.synthesia.io/v2/videos?limit=10',
      { method: 'GET', headers },
      TIMEOUTS.SYNTHESIA_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `Synthesia API error: ${response.status} - ${errorText}`,
      }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Synthesia API connected',
      videoCount: data.videos?.length || 0,
      videos: data.videos || [],
    });
  } catch (error) {
    console.error('Error connecting to Synthesia:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Synthesia',
      },
      { status: 500 }
    );
  }
}
