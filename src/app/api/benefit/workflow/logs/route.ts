/**
 * Benefit Workflow Logs API
 * Returns recent benefit video workflows for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const db = admin.firestore();

    const searchParams = request.nextUrl.searchParams;
    const showHistory = searchParams.get('history') === 'true';

    const workflows: any[] = [];

    if (showHistory) {
      // Get last 20 workflows
      const snapshot = await db
        .collection('benefit_workflow_queue')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      snapshot.forEach(doc => {
        workflows.push({
          id: doc.id,
          ...doc.data()
        });
      });
    } else {
      // Get only active workflows and recently failed ones
      const activeStatuses = ['heygen_processing', 'submagic_processing', 'video_processing', 'posting', 'failed'];

      for (const status of activeStatuses) {
        const snapshot = await db
          .collection('benefit_workflow_queue')
          .where('status', '==', status)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get();

        snapshot.forEach(doc => {
          workflows.push({
            id: doc.id,
            ...doc.data()
          });
        });
      }
    }

    // Sort by creation time (newest first)
    workflows.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({
      success: true,
      workflows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching benefit workflows:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
