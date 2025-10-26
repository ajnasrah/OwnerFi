// Property Video Workflow Logs API
// Returns workflow logs for property video generation

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const showHistory = searchParams.get('history') === 'true';

    const adminDb = await getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const propertyVideosRef = (adminDb as any).collection('property_videos');

    // Get recent workflows and filter in memory to avoid index requirements
    const query = propertyVideosRef
      .orderBy('createdAt', 'desc')
      .limit(showHistory ? 50 : 100); // Get more if filtering for active only

    const snapshot = await query.get();

    // Filter in memory if showing active only
    let docs = snapshot.docs;
    if (!showHistory) {
      const activeStatuses = ['queued', 'heygen_processing', 'submagic_processing', 'posting'];
      docs = docs.filter(doc => {
        const status = doc.data().status;
        return activeStatuses.includes(status);
      }).slice(0, 20); // Limit to 20 after filtering
    }

    const workflows = docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        propertyId: data.propertyId,
        variant: data.variant || '15sec',
        address: data.address || 'Unknown Address',
        city: data.city || 'Unknown City',
        state: data.state || '',
        downPayment: data.downPayment || 0,
        monthlyPayment: data.monthlyPayment || 0,
        status: data.status || 'queued',
        heygenVideoId: data.heygenVideoId,
        submagicProjectId: data.submagicProjectId,
        latePostId: data.latePostId,
        error: data.error,
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now()
      };
    });

    return NextResponse.json({
      success: true,
      workflows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching property workflow logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
