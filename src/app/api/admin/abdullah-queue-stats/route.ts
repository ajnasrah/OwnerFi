/**
 * Abdullah Queue Statistics API
 * Returns queue stats and recent workflows for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // Get queue stats
    const queueRef = collection(db, 'abdullah_content_queue');

    // Get pending count
    const pendingQuery = query(queueRef, where('status', '==', 'pending'));
    const pendingSnap = await getDocs(pendingQuery);

    // Get generating count
    const generatingQuery = query(queueRef, where('status', '==', 'generating'));
    const generatingSnap = await getDocs(generatingQuery);

    // Get completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const completedQuery = query(
      queueRef,
      where('status', '==', 'completed'),
      where('completedAt', '>=', Timestamp.fromDate(todayStart))
    );
    const completedSnap = await getDocs(completedQuery);

    // Get failed count
    const failedQuery = query(queueRef, where('status', '==', 'failed'));
    const failedSnap = await getDocs(failedQuery);

    // Get next pending items with schedule
    const nextItemsQuery = query(
      queueRef,
      where('status', '==', 'pending'),
      orderBy('scheduledGenerationTime', 'asc'),
      limit(5)
    );
    const nextItemsSnap = await getDocs(nextItemsQuery);

    const nextItems = nextItemsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        theme: data.theme,
        title: data.title,
        scheduledGenerationTime: data.scheduledGenerationTime?.toDate?.().toISOString(),
        scheduledPostTime: data.scheduledPostTime?.toDate?.().toISOString(),
      };
    });

    // Get workflow stats from abdullah_workflow_queue
    const workflowRef = collection(db, 'abdullah_workflow_queue');
    const workflowQuery = query(
      workflowRef,
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const workflowSnap = await getDocs(workflowQuery);

    const workflows = workflowSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || data.articleTitle,
        status: data.status,
        createdAt: data.createdAt,
        heygenVideoId: data.heygenVideoId,
        submagicVideoId: data.submagicVideoId,
        latePostId: data.latePostId,
      };
    });

    const stats = {
      queue: {
        pending: pendingSnap.size,
        generating: generatingSnap.size,
        completedToday: completedSnap.size,
        failed: failedSnap.size,
        total: pendingSnap.size + generatingSnap.size + completedSnap.size + failedSnap.size,
      },
      nextItems,
      workflows,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('Error fetching Abdullah queue stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
