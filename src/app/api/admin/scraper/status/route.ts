import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cert } from 'firebase-admin/app';

// Initialize Firebase Admin (if not already initialized)
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
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const jobDoc = await db.collection('scraper_jobs').doc(jobId).get();

    if (!jobDoc.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobDoc.data();

    // Map internal states to user-friendly messages
    let displayStatus = jobData?.status || 'unknown';
    if (displayStatus === 'pending') {
      displayStatus = 'queued';
    } else if (displayStatus === 'processing') {
      displayStatus = 'scraping';
    }

    return NextResponse.json({
      status: displayStatus,
      total: jobData?.total || 0,
      imported: jobData?.imported || 0,
      progress: jobData?.progress || 0,
      error: jobData?.error,
    });

  } catch (error: any) {
    console.error('Status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
