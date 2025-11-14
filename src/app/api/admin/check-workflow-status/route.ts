/**
 * Admin endpoint to check workflow status for debugging
 * GET /api/admin/check-workflow-status?brand=carz&limit=20
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // Optional filter

    const adminDb = await getAdminDb();
    const results: Record<string, any> = {};

    // Brands to check
    const brands = brand === 'all'
      ? ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah', 'personal', 'podcast']
      : [brand];

    for (const b of brands) {
      const collectionName = b === 'podcast' ? 'podcast_workflow_queue' :
                            b === 'property' ? 'property_videos' :
                            `${b}_workflow_queue`;

      let query = adminDb.collection(collectionName);

      // Apply status filter if provided
      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      results[b] = {
        collection: collectionName,
        count: snapshot.size,
        workflows: snapshot.docs.map(doc => {
          const data = doc.data();
          const now = Date.now();
          const stuckMinutes = Math.round((now - (data.updatedAt || data.createdAt || now)) / 60000);

          return {
            id: doc.id,
            status: data.status,
            createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : null,
            updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : null,
            stuckMinutes,
            title: data.title || data.articleTitle || data.episodeTitle || 'N/A',
            heygenVideoId: data.heygenVideoId || null,
            submagicVideoId: data.submagicVideoId || data.submagicProjectId || null,
            submagicDownloadUrl: !!data.submagicDownloadUrl,
            finalVideoUrl: !!data.finalVideoUrl,
            latePostId: data.latePostId || null,
            error: data.error || null,
          };
        })
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Error checking workflow status:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
