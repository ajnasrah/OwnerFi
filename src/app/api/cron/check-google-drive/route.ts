/**
 * Google Drive Video Monitor Cron Job
 *
 * Checks Google Drive folder for new raw video uploads every 5-10 minutes
 * Automatically processes videos through Submagic and posts to social media
 *
 * Schedule: every 5 minutes
 * Timeout: 300 seconds (5 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUnprocessedVideos,
  markFileAsProcessed,
  downloadFile,
  uploadToTempStorage,
  deleteFile,
  getFileMetadata,
} from '@/lib/google-drive-client';
import { getBrandConfig } from '@/config/brand-configs';
import { getAdminDb } from '@/lib/firebase-admin';
import { Readable } from 'stream';

// Maximum execution time for this cron job
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/cron/check-google-drive
 * Monitors Google Drive folder for new videos
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized Google Drive cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 [Personal] Checking Google Drive for new videos...');

    // Get brand configuration
    const brandConfig = getBrandConfig('personal');

    // Get unprocessed videos from Google Drive
    const unprocessedVideos = await getUnprocessedVideos();

    if (unprocessedVideos.length === 0) {
      console.log('✅ [Personal] No new videos found in Google Drive');
      return NextResponse.json({
        success: true,
        message: 'No new videos',
        videosProcessed: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`📹 [Personal] Found ${unprocessedVideos.length} new video(s) in Google Drive`);

    const results = [];

    // Process each video (limit to 3 per run to avoid timeout)
    const videosToProcess = unprocessedVideos.slice(0, 3);

    for (const video of videosToProcess) {
      if (!video.id || !video.name) {
        console.warn('⚠️  [Personal] Skipping video with missing ID or name');
        continue;
      }

      try {
        console.log(`\n📹 [Personal] Processing video: ${video.name}`);

        // Get full metadata
        const metadata = await getFileMetadata(video.id);
        console.log(`   File size: ${formatFileSize(metadata.size)}`);
        console.log(`   Created: ${metadata.createdTime}`);

        // Create workflow in Firestore
        const adminDb = await getAdminDb();
        const workflowRef = adminDb.collection(brandConfig.collections.workflows).doc();
        const workflowId = workflowRef.id;

        const workflow = {
          brand: 'personal',
          status: 'pending',
          fileName: video.name,
          fileId: video.id,
          fileSize: metadata.size || '0',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          platforms: brandConfig.platforms.default,
          source: 'google_drive',
        };

        await workflowRef.set(workflow);
        console.log(`✅ [Personal] Created workflow: ${workflowId}`);

        // Download video from Google Drive
        console.log(`📥 [Personal] Downloading video from Google Drive...`);
        const fileStream = await downloadFile(video.id);

        // Upload to temporary R2 storage (Submagic needs a URL)
        console.log(`📤 [Personal] Uploading to temporary storage...`);
        const tempVideoUrl = await uploadToTempStorage(fileStream, video.name);

        // Update workflow with temp URL
        await workflowRef.update({
          tempVideoUrl,
          updatedAt: Date.now(),
        });

        // Send to Submagic for processing
        console.log(`✨ [Personal] Sending to Submagic for AI processing...`);
        await sendToSubmagic(workflowId, tempVideoUrl, video.name);

        // Update workflow status
        await workflowRef.update({
          status: 'submagic_processing',
          updatedAt: Date.now(),
        });

        // Mark as processed ONLY after successfully sending to Submagic
        // This ensures retry if upload or Submagic submission fails
        await markFileAsProcessed(video.id, workflowId);
        console.log(`✅ [Personal] Marked file as processed after successful Submagic submission`);

        results.push({
          videoId: video.id,
          videoName: video.name,
          workflowId,
          status: 'processing',
        });

        console.log(`✅ [Personal] Video queued for processing: ${video.name}`);
      } catch (error) {
        console.error(`❌ [Personal] Error processing video ${video.name}:`, error);

        results.push({
          videoId: video.id,
          videoName: video.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ [Personal] Processed ${results.length} video(s) in ${duration}ms`);

    return NextResponse.json({
      success: true,
      videosFound: unprocessedVideos.length,
      videosProcessed: results.length,
      results,
      duration,
    });
  } catch (error) {
    console.error('❌ [Personal] Google Drive cron error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * Send video to Submagic for AI processing
 */
async function sendToSubmagic(
  workflowId: string,
  videoUrl: string,
  fileName: string
): Promise<void> {
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

  if (!SUBMAGIC_API_KEY) {
    throw new Error('SUBMAGIC_API_KEY not configured');
  }

  const brandConfig = getBrandConfig('personal');

  // Clean up filename for title (remove extension, max 50 chars)
  let title = fileName.replace(/\.(mp4|mov|avi|mkv)$/i, '');
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }

  // Submagic configuration (based on user preferences)
  const submagicConfig = {
    title,
    language: 'en',
    videoUrl,
    webhookUrl: brandConfig.webhooks.submagic,
    templateName: 'Hormozi 2', // Professional captions
    magicZooms: true, // Auto zoom on important moments
    magicBrolls: false, // No B-rolls (user preference)
    magicBrollsPercentage: 0,
    removeSilencePace: 'fast', // Fast silence removal
    removeBadTakes: true, // Remove mistakes
  };

  console.log(`📤 [Personal] Submagic config:`, JSON.stringify(submagicConfig, null, 2));

  const response = await fetch('https://api.submagic.co/v1/projects', {
    method: 'POST',
    headers: {
      'x-api-key': SUBMAGIC_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submagicConfig),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const projectId = data?.id || data?.project_id || data?.projectId;

  if (!projectId) {
    throw new Error('Submagic did not return a project ID');
  }

  console.log(`✅ [Personal] Submagic project created: ${projectId}`);

  // Save Submagic project ID to workflow
  const adminDb = await getAdminDb();
  await adminDb.collection('personal_workflow_queue').doc(workflowId).update({
    submagicProjectId: projectId,
    updatedAt: Date.now(),
  });

  // Track cost
  try {
    const { trackCost, calculateSubmagicCost } = await import('@/lib/cost-tracker');
    const estimatedDuration = 60; // Assume 60 seconds for cost estimation
    const cost = calculateSubmagicCost(estimatedDuration);

    await trackCost({
      brand: 'personal',
      service: 'submagic',
      operation: 'caption_generation',
      cost,
      metadata: {
        workflowId,
        projectId,
        fileName,
      },
    });
  } catch (costError) {
    console.warn('⚠️  [Personal] Failed to track Submagic cost:', costError);
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: string | undefined | null): string {
  if (!bytes) return 'Unknown';

  const size = parseInt(bytes, 10);
  if (isNaN(size)) return 'Unknown';

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let fileSize = size;

  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }

  return `${fileSize.toFixed(2)} ${units[unitIndex]}`;
}
