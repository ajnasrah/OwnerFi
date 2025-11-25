// Update Podcast Guest Profile API
// PUT /api/podcast/profiles/[id] - Update a specific guest profile

import { NextRequest, NextResponse } from 'next/server';
import { updateGuestProfile, getGuestProfile } from '@/lib/feed-store-firestore';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: guestId } = await params;
    const updates = await request.json();

    // Verify guest exists
    const existing = await getGuestProfile(guestId);
    if (!existing) {
      return NextResponse.json({
        success: false,
        error: `Guest profile '${guestId}' not found`
      }, { status: 404 });
    }

    // Update the profile
    await updateGuestProfile(guestId, updates);

    // Get updated profile
    const updated = await getGuestProfile(guestId);

    return NextResponse.json({
      success: true,
      profile: updated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error updating guest profile:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
