/**
 * HeyGen API Client with Cost Tracking & Budget Enforcement
 *
 * This module wraps all HeyGen API calls with:
 * - Automatic quota checking before video generation
 * - Cost tracking after each API call
 * - Budget enforcement (blocks calls if budget exceeded)
 * - Real-time alerts when approaching limits
 *
 * HeyGen Pricing: $330/month for 660 credits = $0.50/credit
 * 1 video = 1 credit
 */

import { apiKeys } from './env-config';
import {
  trackCost,
  calculateHeyGenCost,
  canAfford,
  checkAndAlert,
} from './cost-tracker';
import { Brand } from '@/config/constants';
import { fetchWithTimeout, circuitBreakers, TIMEOUTS } from './api-utils';

const HEYGEN_API_BASE = 'https://api.heygen.com';

// ============================================================================
// Types
// ============================================================================

export interface HeyGenQuotaResponse {
  remaining_quota: number; // Raw quota units
  remainingCredits: number; // Quota / 60 = credits
  details?: Record<string, any>;
}

export interface HeyGenVideoRequest {
  video_inputs: Array<{
    character: {
      type: 'avatar' | 'talking_photo';
      avatar_id?: string;
      talking_photo_id?: string;
      avatar_style?: string;
      talking_style?: string;
      scale?: number;
    };
    voice: {
      type: 'text';
      input_text: string;
      voice_id: string;
      speed?: number;
    };
  }>;
  caption?: boolean;
  dimension: {
    width: number;
    height: number;
  };
  test?: boolean;
  webhook_url?: string;
  callback_id?: string;
}

export interface HeyGenVideoResponse {
  success: boolean;
  video_id?: string;
  error?: string;
  data?: {
    video_id: string;
    [key: string]: any;
  };
}

// ============================================================================
// Quota Checking
// ============================================================================

/**
 * Get remaining HeyGen quota
 * Quota is returned in raw units - divide by 60 to get credits
 */
export async function getHeyGenQuota(): Promise<HeyGenQuotaResponse> {
  try {
    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        `${HEYGEN_API_BASE}/v2/user/remaining_quota`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': apiKeys.heygen,
          },
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen quota API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const remainingQuota = data.remaining_quota || 0;
    const remainingCredits = Math.floor(remainingQuota / 60); // Convert quota to credits

    console.log(`💳 HeyGen Quota API Response:`, JSON.stringify(data, null, 2));
    console.log(`💳 HeyGen Quota: ${remainingQuota} units (${remainingCredits} credits remaining)`);

    // Warn if quota seems suspiciously low compared to typical plans
    if (remainingQuota > 0 && remainingQuota < 60) {
      console.warn(`⚠️  WARNING: Remaining quota is only ${remainingQuota} units (< 1 credit)`);
      console.warn(`   This will show as 0 credits. If HeyGen dashboard shows more credits, there may be an API sync issue.`);
    }

    return {
      remaining_quota: remainingQuota,
      remainingCredits,
      details: data.details,
    };
  } catch (error) {
    console.error('❌ Error fetching HeyGen quota:', error);
    throw error;
  }
}

/**
 * Check if we have sufficient HeyGen quota before making a video
 * Checks both HeyGen account quota AND our budget system
 */
export async function checkHeyGenQuota(
  videosToGenerate: number = 1,
  brand: Brand
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // 1. Check our budget system first (fastest check)
    const budgetCheck = await canAfford('heygen', videosToGenerate);

    if (!budgetCheck.allowed) {
      console.warn(`⛔ ${budgetCheck.reason}`);

      // Send alert if not already sent
      await checkAndAlert('heygen', 'daily');

      return {
        allowed: false,
        reason: budgetCheck.reason,
      };
    }

    // Log if we're approaching the budget limit
    if (budgetCheck.status.nearLimit) {
      console.warn(
        `⚠️  HeyGen budget at ${budgetCheck.status.percentage.toFixed(1)}% (${budgetCheck.status.used}/${budgetCheck.status.limit})`
      );
    }

    // 2. Check actual HeyGen account quota
    const quota = await getHeyGenQuota();

    // TEMPORARY: Skip quota check if BYPASS_HEYGEN_QUOTA_CHECK is set
    // Use this when HeyGen dashboard shows credits but API reports 0
    const bypassQuotaCheck = process.env.BYPASS_HEYGEN_QUOTA_CHECK === 'true';

    if (bypassQuotaCheck) {
      console.warn(`⚠️  BYPASSING HeyGen quota check (BYPASS_HEYGEN_QUOTA_CHECK=true)`);
      console.warn(`   API reports: ${quota.remainingCredits} credits`);
      console.warn(`   Proceeding anyway - verify HeyGen dashboard shows sufficient credits`);
    } else if (quota.remainingCredits < videosToGenerate) {
      const errorMsg = `Insufficient HeyGen quota: ${quota.remainingCredits} credits remaining, need ${videosToGenerate}`;
      console.error(`❌ ${errorMsg}`);
      console.error(`   If HeyGen dashboard shows more credits, set BYPASS_HEYGEN_QUOTA_CHECK=true`);

      return {
        allowed: false,
        reason: errorMsg,
      };
    }

    // Log warning if HeyGen quota is low (< 50 credits)
    if (quota.remainingCredits < 50) {
      console.warn(
        `⚠️  HeyGen quota low: ${quota.remainingCredits} credits remaining (${(quota.remainingCredits / 660 * 100).toFixed(1)}% of monthly allocation)`
      );
    }

    return { allowed: true };

  } catch (error) {
    console.error('❌ Error checking HeyGen quota:', error);

    // In case of error checking quota, allow the request but log the error
    // This prevents quota check failures from blocking video generation
    return {
      allowed: true,
      reason: 'Quota check failed - proceeding with caution',
    };
  }
}

// ============================================================================
// Video Generation
// ============================================================================

/**
 * Generate video with HeyGen (with cost tracking and budget enforcement)
 */
export async function generateHeyGenVideo(
  request: HeyGenVideoRequest,
  brand: Brand,
  workflowId?: string
): Promise<HeyGenVideoResponse> {
  try {
    // 1. Check quota and budget BEFORE generating (BLOCKING - PREVENT OVERSPEND)
    const quotaCheck = await checkHeyGenQuota(1, brand);

    if (!quotaCheck.allowed) {
      console.error(`❌ [${brand}] HeyGen quota check FAILED - BLOCKING generation to prevent overspend`);
      console.error(`   Reason: ${quotaCheck.reason}`);

      return {
        success: false,
        error: `HeyGen quota insufficient: ${quotaCheck.reason}. Check HeyGen dashboard and budget limits.`,
      };
    }

    console.log(`✓ [${brand}] HeyGen quota check passed`);

    // 2. Generate the video
    console.log(`🎬 [${brand}] Generating HeyGen video...`);

    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        `${HEYGEN_API_BASE}/v2/video/generate`,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': apiKeys.heygen,
          },
          body: JSON.stringify(request),
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error(`❌ HeyGen API error: ${errorMsg}`);

      return {
        success: false,
        error: `HeyGen API error: ${errorMsg}`,
      };
    }

    const data = await response.json();
    const videoId = data.data?.video_id || data.video_id;

    if (!videoId) {
      console.error('❌ HeyGen response missing video_id:', JSON.stringify(data));
      return {
        success: false,
        error: 'HeyGen response missing video_id',
      };
    }

    console.log(`✅ [${brand}] HeyGen video created: ${videoId}`);

    // 3. Track the cost AFTER successful generation
    const cost = calculateHeyGenCost(1);
    await trackCost(
      brand,
      'heygen',
      'video_generation',
      1, // 1 credit
      cost,
      workflowId,
      {
        video_id: videoId,
        dimensions: request.dimension,
        avatar_type: request.video_inputs[0]?.character.type,
      }
    );

    // 4. Check if we should send budget alerts
    await checkAndAlert('heygen', 'daily');

    return {
      success: true,
      video_id: videoId,
      data,
    };

  } catch (error) {
    console.error('❌ Error generating HeyGen video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get HeyGen video status
 * This is free (doesn't consume credits) but we track the call for monitoring
 */
export async function getHeyGenVideoStatus(videoId: string): Promise<any> {
  try {
    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': apiKeys.heygen,
          },
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen status API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Error getting HeyGen video status:', error);
    throw error;
  }
}

/**
 * List available HeyGen avatars
 * Free call (doesn't consume credits)
 */
export async function getHeyGenAvatars(): Promise<any[]> {
  try {
    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        `${HEYGEN_API_BASE}/v2/avatars`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': apiKeys.heygen,
          },
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen avatars API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.avatars || [];

  } catch (error) {
    console.error('❌ Error fetching HeyGen avatars:', error);
    return [];
  }
}

/**
 * List available HeyGen voices
 * Free call (doesn't consume credits)
 */
export async function getHeyGenVoices(): Promise<any[]> {
  try {
    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        `${HEYGEN_API_BASE}/v2/voices`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': apiKeys.heygen,
          },
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen voices API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.voices || [];

  } catch (error) {
    console.error('❌ Error fetching HeyGen voices:', error);
    return [];
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  getHeyGenQuota,
  checkHeyGenQuota,
  generateHeyGenVideo,
  getHeyGenVideoStatus,
  getHeyGenAvatars,
  getHeyGenVoices,
};
