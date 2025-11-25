import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

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

/**
 * GET /api/admin/recent-scripts
 * Fetches the most recent ChatGPT-generated scripts from abdullah_workflow_queue
 * for review and prompt improvement purposes
 */
export async function GET(request: NextRequest) {
  try {
    // Get limit from query params (default 10)
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    // Fetch recent workflows that have scripts
    const snapshot = await db.collection('abdullah_workflow_queue')
      .orderBy('createdAt', 'desc')
      .limit(limit * 2) // Fetch more to filter out ones without scripts
      .get();

    const scripts: Array<{
      id: string;
      title: string;
      script: string;
      caption: string;
      theme: string;
      hook: string;
      status: string;
      createdAt: number;
      finalVideoUrl?: string;
    }> = [];

    for (const doc of snapshot.docs) {
      if (scripts.length >= limit) break;

      const data = doc.data();

      // Only include workflows that have a script
      if (data.script) {
        scripts.push({
          id: doc.id,
          title: data.title || data.articleTitle || 'Untitled',
          script: data.script,
          caption: data.caption || '',
          theme: data.theme || 'unknown',
          hook: data.hook || '',
          status: data.status || 'unknown',
          createdAt: data.createdAt || 0,
          finalVideoUrl: data.finalVideoUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      scripts,
      count: scripts.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching recent scripts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recent scripts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
