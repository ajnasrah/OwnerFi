// Property Video Workflow Logs API (Spanish)
// Returns workflow logs for Spanish property video generation

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const showHistory = searchParams.get('history') === 'true';

    const adminDb = await getAdminDb();
    if (!adminDb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { success: false, error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // Use NEW propertyShowcaseWorkflows collection
    const propertyWorkflowsRef = (adminDb as any).collection('propertyShowcaseWorkflows');

    let snapshot;
    try {
      // Get recent Spanish workflows
      const query = propertyWorkflowsRef
        .where('language', '==', 'es')
        .orderBy('createdAt', 'desc')
        .limit(showHistory ? 50 : 100);

      snapshot = await query.get();
    } catch (queryError) {
      console.error('Firestore query error:', queryError);
      // If query fails (e.g., missing index), return empty result instead of 500
      return NextResponse.json({
        success: true,
        workflows: [],
        timestamp: new Date().toISOString(),
        warning: 'Query failed - possibly missing Firestore index. Please check Firebase console.'
      });
    }

    // Get all Spanish workflows
    let docs = snapshot.docs;

    // Further filter if showing active only
    if (!showHistory) {
      const activeStatuses = ['queued', 'heygen_processing', 'submagic_processing', 'posting'];
      docs = docs.filter(doc => {
        const status = doc.data().status;
        return activeStatuses.includes(status);
      }).slice(0, 20);
    }

    const workflows = await Promise.all(docs.map(async (doc) => {
      const data = doc.data();

      // Fetch property details if propertyId exists
      let propertyData: any = {};
      if (data.propertyId) {
        try {
          const propertyDoc = await (adminDb as any).collection('properties').doc(data.propertyId).get();
          if (propertyDoc.exists) {
            propertyData = propertyDoc.data();
          }
        } catch (error) {
          console.error(`Failed to fetch property ${data.propertyId}:`, error);
        }
      }

      return {
        id: doc.id,
        propertyId: data.propertyId,
        variant: data.variant || '15sec',
        language: data.language || 'es',
        address: data.address || propertyData.address || 'Unknown Address',
        city: data.city || propertyData.city || 'Unknown City',
        state: data.state || propertyData.state || '',
        downPayment: data.downPayment || propertyData.downPayment || 0,
        monthlyPayment: data.monthlyPayment || propertyData.monthlyPayment || 0,
        status: data.status || 'queued',
        heygenVideoId: data.heygenVideoId,
        submagicProjectId: data.submagicProjectId,
        latePostId: data.latePostId,
        error: data.error,
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now()
      };
    }));

    return NextResponse.json({
      success: true,
      workflows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching Spanish property workflow logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
