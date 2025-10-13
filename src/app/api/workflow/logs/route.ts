// Real-time Workflow Logs API
// Returns all active workflows with their current status

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

const COLLECTIONS = {
  CARZ: 'carz_workflow_queue',
  OWNERFI: 'ownerfi_workflow_queue',
};

export async function GET(request: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    // Parse URL to check for history query param
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    let carzQuery, ownerfiQuery;

    if (includeHistory) {
      // Get all recent workflows (last 50)
      carzQuery = query(
        collection(db, COLLECTIONS.CARZ),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(50)
      );

      ownerfiQuery = query(
        collection(db, COLLECTIONS.OWNERFI),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(50)
      );
    } else {
      // Get active workflows only
      carzQuery = query(
        collection(db, COLLECTIONS.CARZ),
        where('status', 'in', ['pending', 'heygen_processing', 'submagic_processing', 'posting']),
        orderBy('createdAt', 'desc'),
        firestoreLimit(20)
      );

      ownerfiQuery = query(
        collection(db, COLLECTIONS.OWNERFI),
        where('status', 'in', ['pending', 'heygen_processing', 'submagic_processing', 'posting']),
        orderBy('createdAt', 'desc'),
        firestoreLimit(20)
      );
    }

    const [carzSnapshot, ownerfiSnapshot] = await Promise.all([
      getDocs(carzQuery),
      getDocs(ownerfiQuery)
    ]);

    const carzWorkflows = carzSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const ownerfiWorkflows = ownerfiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      success: true,
      workflows: {
        carz: carzWorkflows,
        ownerfi: ownerfiWorkflows
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching workflow logs:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
