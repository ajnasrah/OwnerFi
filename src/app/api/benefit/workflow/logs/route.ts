/**
 * Benefit Workflow Logs API
 * Returns recent benefit video workflows for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

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
      const q = query(
        collection(db, 'benefit_workflow_queue'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        workflows.push({
          id: doc.id,
          ...doc.data()
        });
      });
    } else {
      // Get only active workflows
      const activeStatuses = ['heygen_processing', 'submagic_processing', 'video_processing', 'posting'];

      for (const status of activeStatuses) {
        const q = query(
          collection(db, 'benefit_workflow_queue'),
          where('status', '==', status),
          orderBy('createdAt', 'desc'),
          limit(10)
        );

        const snapshot = await getDocs(q);
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
