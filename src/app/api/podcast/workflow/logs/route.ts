// Podcast Workflow Logs API
// Returns active podcast generation workflows for status tracking
// Supports ?history=true to view all recent workflows (last 50)

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

const PODCAST_COLLECTION = 'podcast_workflow_queue';

export async function GET(request: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    // Parse URL to check for history query param
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    let podcastQuery, snapshot;

    if (includeHistory) {
      // Get all recent workflows (last 50)
      podcastQuery = query(
        collection(db, PODCAST_COLLECTION),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(50)
      );
    } else {
      // Get active workflows only
      podcastQuery = query(
        collection(db, PODCAST_COLLECTION),
        where('status', 'in', ['script_generation', 'heygen_processing', 'submagic_processing', 'publishing']),
        orderBy('createdAt', 'desc'),
        firestoreLimit(20)
      );
    }

    snapshot = await getDocs(podcastQuery);
    const workflows = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data };
    });

    return NextResponse.json({
      success: true,
      workflows: workflows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching podcast workflows:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
