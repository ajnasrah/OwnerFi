import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';

// Allow up to 5 minutes for large syncs
export const maxDuration = 300;

/**
 * GET/POST /api/admin/typesense/sync
 *
 * Bulk syncs all active properties from Firestore to Typesense.
 * Admin-only. Used when setting up a new Typesense cluster.
 * Processes in parallel batches of 10 for speed.
 */
export { handler as GET, handler as POST };

async function handler(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    const snap = await getDocs(query(
      collection(db, 'properties'),
      where('isActive', '==', true)
    ));

    const total = snap.size;
    let indexed = 0;
    let failed = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 10;

    // Process in parallel batches for speed
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = snap.docs.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(doc => indexRawFirestoreProperty(doc.id, doc.data(), 'properties'))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && result.value) {
          indexed++;
        } else {
          failed++;
          errors.push(batch[j].id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      total,
      indexed,
      failed,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
