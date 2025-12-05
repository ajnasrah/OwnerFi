// Benefit Workflow Logs API
// Returns all benefit workflows with their current status

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

const COLLECTION = 'benefit_workflow_queue';

export async function GET(request: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    // Parse URL to check for history query param
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    // Fetch workflows by createdAt only (no index needed), then filter in memory
    const fetchLimit = includeHistory ? 50 : 100; // Get more if filtering for active

    const snapshot = await getDocs(
      query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), firestoreLimit(fetchLimit))
    );

    // Filter in memory if showing active only (avoids composite index requirement)
    const activeStatuses = ['heygen_processing', 'submagic_processing', 'video_processing', 'posting'];

    let workflows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!includeHistory) {
      workflows = workflows.filter((w: any) => activeStatuses.includes(w.status)).slice(0, 20);
    }

    return NextResponse.json({
      success: true,
      workflows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching benefit workflow logs:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
