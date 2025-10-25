// Property Video Workflow Logs API
// Returns workflow logs for property video generation

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const showHistory = searchParams.get('history') === 'true';

    const db = admin.firestore();
    const propertyVideosRef = db.collection('property_videos');

    let query;
    if (showHistory) {
      // Show all workflows (completed and failed too)
      query = propertyVideosRef
        .orderBy('createdAt', 'desc')
        .limit(50);
    } else {
      // Only show active workflows (not completed or failed)
      query = propertyVideosRef
        .where('status', 'in', ['queued', 'heygen_processing', 'submagic_processing', 'posting'])
        .orderBy('createdAt', 'desc')
        .limit(20);
    }

    const snapshot = await query.get();

    const workflows = snapshot.docs.map(doc => {
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
