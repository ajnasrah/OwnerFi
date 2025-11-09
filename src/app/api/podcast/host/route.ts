// Update Podcast Host Profile API
// PUT /api/podcast/host - Update the host profile

import { NextRequest, NextResponse } from 'next/server';
import { updateHostProfile, getHostProfile } from '@/lib/feed-store-firestore';

export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json();

    // Update the host profile
    await updateHostProfile(updates);

    // Get updated profile
    const updated = await getHostProfile();

    return NextResponse.json({
      success: true,
      profile: updated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error updating host profile:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const profile = await getHostProfile();

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'Host profile not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error fetching host profile:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
