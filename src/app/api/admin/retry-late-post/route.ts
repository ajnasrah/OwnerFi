// API endpoint to retry failed Late posts
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { postToLate } from '@/lib/late-api';

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

/**
 * POST - Retry a failed Late post
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { failureId, brand, platforms, caption, videoUrl, scheduleTime } = body;

    if (!failureId || !brand || !platforms || !videoUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: failureId, brand, platforms, videoUrl',
        },
        { status: 400 }
      );
    }

    // Get the failure record
    const failureDoc = await db.collection('late_failures').doc(failureId).get();

    if (!failureDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Failure record not found' },
        { status: 404 }
      );
    }

    const failureData = failureDoc.data();

    // Update status to retrying
    await db.collection('late_failures').doc(failureId).update({
      status: 'retrying',
      retryCount: (failureData?.retryCount || 0) + 1,
      lastRetryAt: new Date(),
    });

    console.log(`🔄 Retrying Late post for ${brand}`);
    console.log(`   Failure ID: ${failureId}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);

    // Attempt to post to Late again using queue system
    const result = await postToLate({
      brand: brand as any,
      platforms: platforms as any,
      caption: caption || '',
      title: caption || 'Retry Post',
      videoUrl: videoUrl,
      scheduleTime: scheduleTime,
      useQueue: true, // ✅ Use GetLate's queue system
      timezone: 'America/Chicago'
    });

    if (result.success) {
      // Mark as resolved
      await db.collection('late_failures').doc(failureId).update({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedPostId: result.postId,
      });

      console.log(`✅ Retry successful! Post ID: ${result.postId}`);

      return NextResponse.json({
        success: true,
        message: 'Post retried successfully',
        postId: result.postId,
        scheduledFor: result.scheduledFor,
      });
    } else {
      // Keep as retrying with error
      await db.collection('late_failures').doc(failureId).update({
        status: 'failed',
        lastRetryError: result.error,
      });

      console.error(`❌ Retry failed: ${result.error}`);

      return NextResponse.json({
        success: false,
        error: result.error || 'Retry failed',
      });
    }
  } catch (error) {
    console.error('Error retrying Late post:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry post',
      },
      { status: 500 }
    );
  }
}
