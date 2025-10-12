// Video Status Polling Backup
// Polls HeyGen for video status if webhooks aren't working

import { fetchWithTimeout, retry, TIMEOUTS } from './api-utils';
import { getWorkflow, updateWorkflow } from './workflow-store';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface PendingVideo {
  workflowId: string;
  videoId: string;
  startTime: number;
}

// Track videos we're polling
const pendingVideos = new Map<string, PendingVideo>();
let pollingInterval: NodeJS.Timeout | null = null;

/**
 * Start the polling system
 */
export function startVideoPoller(intervalMs: number = 30000) {
  if (pollingInterval) {
    console.log('⚠️  Video poller already running');
    return;
  }

  console.log('🔄 Starting video status poller (backup for webhooks)...');

  pollingInterval = setInterval(() => {
    checkPendingVideos();
  }, intervalMs);

  // Run immediately
  checkPendingVideos();
}

/**
 * Stop the polling system
 */
export function stopVideoPoller() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('🛑 Video poller stopped');
  }
}

/**
 * Register a video to be polled
 */
export function registerVideoForPolling(workflowId: string, videoId: string) {
  pendingVideos.set(workflowId, {
    workflowId,
    videoId,
    startTime: Date.now()
  });
  console.log(`📝 Registered video for polling: ${videoId}`);
}

/**
 * Check all pending videos
 */
async function checkPendingVideos() {
  if (pendingVideos.size === 0) {
    return;
  }

  console.log(`\n🔍 [POLLING] Checking ${pendingVideos.size} pending videos...`);

  const checks = Array.from(pendingVideos.values()).map(video =>
    checkVideoStatus(video)
  );

  await Promise.allSettled(checks);
}

/**
 * Check status of a single video
 */
async function checkVideoStatus(video: PendingVideo) {
  try {
    // Check if workflow still exists and is pending
    const workflow = getWorkflow(video.workflowId);

    if (!workflow) {
      console.log(`⚠️  Workflow ${video.workflowId} not found, removing from polling`);
      pendingVideos.delete(video.workflowId);
      return;
    }

    if (workflow.status !== 'heygen_pending') {
      // Already processed by webhook or other means
      console.log(`✅ Video ${video.videoId} already processed (${workflow.status})`);
      pendingVideos.delete(video.workflowId);
      return;
    }

    // Check timeout (30 minutes max)
    const elapsed = Date.now() - video.startTime;
    if (elapsed > 30 * 60 * 1000) {
      console.error(`⏰ Video ${video.videoId} timed out after 30 minutes`);
      updateWorkflow(video.workflowId, {
        status: 'failed',
        error: 'Video generation timeout'
      });
      pendingVideos.delete(video.workflowId);
      return;
    }

    // Poll HeyGen API
    const status = await getHeyGenVideoStatus(video.videoId);

    if (status.status === 'completed' && status.videoUrl) {
      console.log(`✅ [POLLING] Video ${video.videoId} completed!`);

      // Update workflow
      updateWorkflow(video.workflowId, {
        videoUrl: status.videoUrl,
        status: 'heygen_complete'
      });

      // Trigger Submagic
      await triggerSubmagicProcessing(video.workflowId, status.videoUrl);

      // Remove from polling
      pendingVideos.delete(video.workflowId);

    } else if (status.status === 'failed') {
      console.error(`❌ [POLLING] Video ${video.videoId} failed`);
      updateWorkflow(video.workflowId, {
        status: 'failed',
        error: status.error || 'HeyGen generation failed'
      });
      pendingVideos.delete(video.workflowId);

    } else {
      // Still processing
      const elapsedMin = Math.round(elapsed / 60000);
      console.log(`⏳ Video ${video.videoId} still processing (${elapsedMin} min)...`);
    }

  } catch (error) {
    console.error(`❌ Error checking video ${video.videoId}:`, error);
  }
}

/**
 * Get HeyGen video status from API
 */
async function getHeyGenVideoStatus(videoId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  if (!HEYGEN_API_KEY) {
    throw new Error('HeyGen API key not configured');
  }

  return retry(
    async () => {
      const response = await fetchWithTimeout(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': HEYGEN_API_KEY
          }
        },
        TIMEOUTS.HEYGEN_SUBMIT
      );

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        status: data.data?.status || 'pending',
        videoUrl: data.data?.video_url,
        error: data.data?.error
      };
    },
    {
      maxAttempts: 2,
      backoff: 'exponential'
    }
  );
}

/**
 * Trigger Submagic processing
 */
async function triggerSubmagicProcessing(workflowId: string, videoUrl: string) {
  if (!SUBMAGIC_API_KEY) {
    console.error('❌ Submagic API key not configured');
    updateWorkflow(workflowId, {
      status: 'failed',
      error: 'Submagic API key not configured'
    });
    return;
  }

  try {
    console.log('✨ Sending to Submagic...');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    await retry(
      async () => {
        const response = await fetchWithTimeout(
          'https://api.submagic.co/v1/projects',
          {
            method: 'POST',
            headers: {
              'x-api-key': SUBMAGIC_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: `Viral Video - ${workflowId}`,
              language: 'en',
              videoUrl: videoUrl,
              templateName: 'Hormozi 2',
              webhookUrl: `${baseUrl}/api/webhooks/submagic`
            })
          },
          TIMEOUTS.SUBMAGIC_SUBMIT
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const projectId = data.id || data.project_id || data.projectId;

        console.log('✅ Submagic project created:', projectId);

        // Update workflow
        updateWorkflow(workflowId, {
          submagicProjectId: projectId,
          status: 'submagic_pending'
        });
      },
      {
        maxAttempts: 3,
        backoff: 'exponential'
      }
    );

  } catch (error) {
    console.error('❌ Error triggering Submagic:', error);
    updateWorkflow(workflowId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get poller status
 */
export function getPollerStatus() {
  return {
    running: pollingInterval !== null,
    pendingVideos: pendingVideos.size,
    videos: Array.from(pendingVideos.values()).map(v => ({
      workflowId: v.workflowId,
      videoId: v.videoId,
      elapsedMinutes: Math.round((Date.now() - v.startTime) / 60000)
    }))
  };
}
