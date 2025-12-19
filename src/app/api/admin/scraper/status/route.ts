import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ExtendedSession } from '@/types/session';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Get job status
    const jobDoc = await db.collection('scraper_jobs').doc(jobId).get();

    if (!jobDoc.exists) {
      // Job might not have been created yet or already cleaned up
      // Check queue status instead
      const pendingCount = await db.collection('scraper_queue')
        .where('status', '==', 'pending')
        .count()
        .get();

      const processingCount = await db.collection('scraper_queue')
        .where('status', '==', 'processing')
        .count()
        .get();

      if (pendingCount.data().count === 0 && processingCount.data().count === 0) {
        return NextResponse.json({
          status: 'complete',
          imported: 0,
          total: 0,
          message: 'Queue is empty',
        });
      }

      return NextResponse.json({
        status: 'processing',
        progress: 50,
        imported: 0,
        total: pendingCount.data().count + processingCount.data().count,
      });
    }

    const jobData = jobDoc.data()!;

    // Check current queue status
    const pendingForJob = await db.collection('scraper_queue')
      .where('source', '==', 'admin_bulk_upload')
      .where('status', '==', 'pending')
      .count()
      .get();

    const completedForJob = await db.collection('scraper_queue')
      .where('source', '==', 'admin_bulk_upload')
      .where('status', '==', 'completed')
      .count()
      .get();

    const total = jobData.total || 0;
    const completed = completedForJob.data().count;
    const pending = pendingForJob.data().count;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // If no more pending items, mark as complete
    if (pending === 0 && completed > 0) {
      return NextResponse.json({
        status: 'complete',
        imported: completed,
        total,
        progress: 100,
      });
    }

    return NextResponse.json({
      status: 'processing',
      imported: completed,
      total,
      progress,
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
