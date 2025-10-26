/**
 * Benefit Workflow Logs API
 * Returns recent benefit video workflows for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const showHistory = searchParams.get('history') === 'true';

    const workflows: any[] = [];

    if (showHistory) {
      // Get last 20 workflows
      const snapshot = await getDocs(
        query(
          collection(db, 'benefit_workflow_queue'),
          orderBy('createdAt', 'desc'),
          firestoreLimit(20)
        )
      );

      snapshot.forEach(doc => {
        workflows.push({
          id: doc.id,
          ...doc.data()
        });
      });
    } else {
      // Get all recent workflows, then filter in memory to avoid index requirements
      const snapshot = await getDocs(
        query(
          collection(db, 'benefit_workflow_queue'),
          orderBy('createdAt', 'desc'),
          firestoreLimit(50)
        )
      );

      const activeStatuses = ['heygen_processing', 'submagic_processing', 'video_processing', 'posting', 'failed'];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (activeStatuses.includes(data.status)) {
          workflows.push({
            id: doc.id,
            ...data
          });
        }
      });
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
