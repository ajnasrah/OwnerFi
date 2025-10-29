// API endpoint to track Late posting failures
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface LateFailure {
  id: string;
  postId?: string;
  brand: string;
  profileId?: string;
  platforms: string[];
  failedPlatforms?: string[];
  caption: string;
  videoUrl: string;
  error: string;
  errorDetails?: {
    platform: string;
    message: string;
  }[];
  timestamp: Date;
  retryCount: number;
  lastRetryAt?: Date;
  status: 'failed' | 'retrying' | 'resolved';
  workflowId?: string;
  workflowType?: string;
}

/**
 * GET - Fetch all Late posting failures
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const status = searchParams.get('status') || 'failed';
    const limit = parseInt(searchParams.get('limit') || '50');
    const days = parseInt(searchParams.get('days') || '7');

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let query = db.collection('late_failures')
      .where('timestamp', '>=', cutoffDate)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (brand) {
      query = query.where('brand', '==', brand) as any;
    }

    if (status !== 'all') {
      query = query.where('status', '==', status) as any;
    }

    const snapshot = await query.get();

    const failures: LateFailure[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
      lastRetryAt: doc.data().lastRetryAt?.toDate(),
    })) as LateFailure[];

    // Get summary stats
    const stats = {
      total: failures.length,
      byBrand: {} as Record<string, number>,
      byPlatform: {} as Record<string, number>,
      byStatus: {
        failed: 0,
        retrying: 0,
        resolved: 0,
      },
      commonErrors: {} as Record<string, number>,
    };

    failures.forEach(failure => {
      // Count by brand
      stats.byBrand[failure.brand] = (stats.byBrand[failure.brand] || 0) + 1;

      // Count by status
      stats.byStatus[failure.status]++;

      // Count by failed platform
      failure.failedPlatforms?.forEach(platform => {
        stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
      });

      // Extract common error types
      const errorType = extractErrorType(failure.error);
      stats.commonErrors[errorType] = (stats.commonErrors[errorType] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      failures,
      stats,
      query: {
        brand,
        status,
        days,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching Late failures:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Late failures',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Log a new Late posting failure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      postId,
      brand,
      profileId,
      platforms,
      failedPlatforms,
      caption,
      videoUrl,
      error,
      errorDetails,
      workflowId,
      workflowType,
    } = body;

    if (!brand || !error) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: brand, error' },
        { status: 400 }
      );
    }

    const failureData: Partial<LateFailure> = {
      postId,
      brand,
      profileId,
      platforms: platforms || [],
      failedPlatforms: failedPlatforms || platforms || [],
      caption: caption || '',
      videoUrl: videoUrl || '',
      error,
      errorDetails,
      timestamp: new Date(),
      retryCount: 0,
      status: 'failed',
      workflowId,
      workflowType,
    };

    const docRef = await db.collection('late_failures').add(failureData);

    console.log(`📝 Logged Late failure: ${docRef.id}`);
    console.log(`   Brand: ${brand}`);
    console.log(`   Failed platforms: ${failedPlatforms?.join(', ')}`);
    console.log(`   Error: ${error.substring(0, 100)}...`);

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error) {
    console.error('Error logging Late failure:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log Late failure',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update failure status (e.g., mark as retrying or resolved)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, retryCount } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, status' },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      lastRetryAt: new Date(),
    };

    if (retryCount !== undefined) {
      updateData.retryCount = retryCount;
    }

    await db.collection('late_failures').doc(id).update(updateData);

    console.log(`✅ Updated Late failure ${id} to status: ${status}`);

    return NextResponse.json({
      success: true,
      id,
      status,
    });
  } catch (error) {
    console.error('Error updating Late failure:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Late failure',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract error type from error message
 */
function extractErrorType(error: string): string {
  if (!error) return 'Unknown';

  const lowerError = error.toLowerCase();

  if (lowerError.includes('401') || lowerError.includes('unauthorized') || lowerError.includes('invalid token')) {
    return 'Authentication (401)';
  }
  if (lowerError.includes('403') || lowerError.includes('forbidden')) {
    return 'Authorization (403)';
  }
  if (lowerError.includes('429') || lowerError.includes('rate limit')) {
    return 'Rate Limit (429)';
  }
  if (lowerError.includes('500') || lowerError.includes('internal server')) {
    return 'Server Error (500)';
  }
  if (lowerError.includes('503') || lowerError.includes('service unavailable')) {
    return 'Service Unavailable (503)';
  }
  if (lowerError.includes('timeout')) {
    return 'Timeout';
  }
  if (lowerError.includes('network') || lowerError.includes('connection')) {
    return 'Network Error';
  }
  if (lowerError.includes('refresh') && lowerError.includes('token')) {
    return 'Token Refresh Failed';
  }
  if (lowerError.includes('missing connected accounts')) {
    return 'Missing Account Connection';
  }

  return 'Other';
}
