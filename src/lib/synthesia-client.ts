/**
 * Synthesia API Client with Cost Tracking & Budget Enforcement
 *
 * Mirrors heygen-client.ts pattern for the Synthesia trial.
 *
 * Synthesia API Reference (confirmed via live testing):
 * - Create video: POST https://api.synthesia.io/v2/videos
 * - Get video:    GET  https://api.synthesia.io/v2/videos/{id}
 * - List videos:  GET  https://api.synthesia.io/v2/videos
 * - Auth: Authorization: {API_KEY}  (NO "Bearer" prefix)
 *
 * Required input fields per clip: avatar, scriptText
 * Optional: background, avatarSettings.voice (UUID), etc.
 *
 * Webhook delivers:
 * { type: "video.completed", data: { id, status, download, callbackId, duration } }
 * Download URLs are presigned and time-limited — must download to R2 promptly.
 */

import { apiKeys } from './env-config';
import {
  trackCost,
  calculateSynthesiaCost,
} from './cost-tracker';
import { Brand, TIMEOUTS } from '@/config/constants';
import { fetchWithTimeout } from './api-utils';

const SYNTHESIA_API_BASE = 'https://api.synthesia.io/v2';

// ============================================================================
// Types
// ============================================================================

export interface SynthesiaClip {
  avatarId: string;
  scriptText: string;
  voiceId?: string; // Optional UUID — omit to use avatar's default voice
}

export interface SynthesiaVideoRequest {
  title: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  clips: SynthesiaClip[];
  callbackId?: string;
}

export interface SynthesiaVideoResponse {
  success: boolean;
  video_id?: string;
  error?: string;
  data?: any;
}

export interface SynthesiaVideoStatus {
  id: string;
  status: 'in_progress' | 'complete' | 'failed';
  download?: string; // Presigned URL (time-limited)
  duration?: string;
  callbackId?: string;
}

// ============================================================================
// Auth Header Helper
// ============================================================================

function getSynthesiaHeaders(): Record<string, string> {
  const key = apiKeys.synthesia;
  if (!key) {
    throw new Error('SYNTHESIA_API_KEY not configured');
  }
  return {
    'Authorization': key,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// ============================================================================
// Quota Checking
// ============================================================================

/**
 * Check Synthesia quota/credits
 * Synthesia doesn't have a dedicated quota endpoint like HeyGen,
 * so we rely on our internal budget system.
 */
export async function checkSynthesiaQuota(
  _brand: Brand
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check our budget system
    const { canAfford } = await import('./cost-tracker');
    const budgetCheck = await canAfford('heygen', 1); // Share budget pool with heygen for trial

    if (!budgetCheck.allowed) {
      console.warn(`Synthesia budget check failed: ${budgetCheck.reason}`);
      return { allowed: false, reason: budgetCheck.reason };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking Synthesia quota:', error);
    // Allow on transient errors
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('timeout') || msg.includes('network')) {
      return { allowed: true, reason: `Quota check failed (transient): ${msg}` };
    }
    return { allowed: false, reason: `Quota check error: ${msg}` };
  }
}

// ============================================================================
// Video Generation
// ============================================================================

/**
 * Generate video with Synthesia (with cost tracking)
 */
export async function generateSynthesiaVideo(
  request: SynthesiaVideoRequest,
  brand: Brand,
  workflowId?: string
): Promise<SynthesiaVideoResponse> {
  try {
    // 1. Check quota/budget
    const quotaCheck = await checkSynthesiaQuota(brand);
    if (!quotaCheck.allowed) {
      console.error(`[${brand}] Synthesia quota check FAILED: ${quotaCheck.reason}`);
      return {
        success: false,
        error: `Synthesia quota insufficient: ${quotaCheck.reason}`,
      };
    }

    console.log(`[${brand}] Synthesia quota check passed`);

    // 2. Build API request body
    // background is required by the API — "default" uses the avatar's built-in background
    const apiBody: Record<string, unknown> = {
      title: request.title,
      input: request.clips.map(clip => {
        const inputItem: Record<string, unknown> = {
          avatar: clip.avatarId,
          scriptText: clip.scriptText,
          background: 'default',
        };

        if (clip.voiceId) {
          inputItem.avatarSettings = { voice: clip.voiceId };
        }

        return inputItem;
      }),
      aspectRatio: request.aspectRatio,
      test: false,
      visibility: 'private',
    };

    if (request.callbackId) {
      apiBody.callbackId = request.callbackId;
    }

    console.log(`[${brand}] Generating Synthesia video...`);

    // 3. Call Synthesia API
    const response = await fetchWithTimeout(
      `${SYNTHESIA_API_BASE}/videos`,
      {
        method: 'POST',
        headers: getSynthesiaHeaders(),
        body: JSON.stringify(apiBody),
      },
      TIMEOUTS.SYNTHESIA_API
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error(`Synthesia API error: ${errorMsg}`, JSON.stringify(errorData));
      return { success: false, error: `Synthesia API error: ${errorMsg}` };
    }

    const data = await response.json();
    const videoId = data.id;

    if (!videoId) {
      console.error('Synthesia response missing video id:', JSON.stringify(data));
      return { success: false, error: 'Synthesia response missing video id' };
    }

    console.log(`[${brand}] Synthesia video created: ${videoId}`);

    // 4. Track cost
    const cost = calculateSynthesiaCost(1);
    await trackCost(
      brand,
      'synthesia',
      'video_generation',
      1,
      cost,
      workflowId,
      { video_id: videoId, aspect_ratio: request.aspectRatio }
    );

    return {
      success: true,
      video_id: videoId,
      data,
    };
  } catch (error) {
    console.error('Error generating Synthesia video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Video Status
// ============================================================================

/**
 * Get Synthesia video status
 */
export async function getSynthesiaVideoStatus(videoId: string): Promise<SynthesiaVideoStatus> {
  const response = await fetchWithTimeout(
    `${SYNTHESIA_API_BASE}/videos/${videoId}`,
    {
      method: 'GET',
      headers: getSynthesiaHeaders(),
    },
    TIMEOUTS.SYNTHESIA_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Synthesia status API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    download: data.download,
    duration: data.duration,
    callbackId: data.callbackId,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  checkSynthesiaQuota,
  generateSynthesiaVideo,
  getSynthesiaVideoStatus,
};
