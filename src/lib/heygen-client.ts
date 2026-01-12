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
      offset_x?: number;
      offset_y?: number;
    };
    voice: {
      type: 'text';
      input_text: string;
      voice_id: string;
      speed?: number;
      emotion?: string;
    };
    background?:
      | { type: 'color'; value: string }
      | { type: 'image'; url: string }
      | { type: 'image'; image_asset_id: string }
      | { type: 'video'; url: string; play_style: string }
      | { type: 'video'; video_asset_id: string; play_style: string };
  }>;
  caption?: boolean;
  dimension: {
    width: number;
    height: number;
  };
  test?: boolean;
  title?: string;
  webhook_url?: string;
  callback_id?: string;
  callback_url?: string;
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
// Avatar IV Types (for more expressive videos with hand gestures)
// ============================================================================

export interface AvatarIVVideoRequest {
  image_key: string;              // From Upload Asset API
  video_title?: string;
  script: string;                 // Text the avatar will speak
  voice_id: string;               // From List Voices API
  voice_speed?: number;           // Voice speed 0.5-1.5 (default 1.0)
  audio_url?: string;             // Alternative: custom audio URL
  audio_asset_id?: string;        // Alternative: HeyGen audio asset
  custom_motion_prompt?: string;  // Describe gestures/expressions (keep under 2 clauses)
  enhance_custom_motion_prompt?: boolean;  // Let AI refine motion
  dimension?: {
    width: number;
    height: number;
  };
  callback_id?: string;
  callback_url?: string;
}

export interface AvatarIVVideoResponse {
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
    // HeyGen API v2 returns data nested under "data" property
    const remainingQuota = data.data?.remaining_quota || data.remaining_quota || 0;
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
      details: data.data?.details || data.details,
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

    // SECURITY: Only allow bypass for specific transient errors, not all errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTransientError =
      errorMessage.includes('timeout') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('network') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('fetch failed');

    if (isTransientError) {
      console.warn('⚠️  Transient error checking quota - allowing request with caution');
      console.warn('   Reason: Network/timeout error, likely temporary');
      return {
        allowed: true,
        reason: `Quota check failed (transient error) - proceeding with caution: ${errorMessage}`,
      };
    }

    // For non-transient errors (auth, invalid API key, etc.), block the request
    console.error('🚫 Non-transient quota check error - blocking request to prevent overspend');
    return {
      allowed: false,
      reason: `Quota check failed with non-transient error: ${errorMessage}`,
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

// ============================================================================
// Avatar IV Video Generation (More Expressive with Hand Gestures)
// ============================================================================

// ============================================================================
// Image Key Caching (Firestore Admin SDK)
// ============================================================================

import { getAdminDb } from './firebase-admin';
import { createHash } from 'crypto';

const IMAGE_KEY_CACHE_COLLECTION = 'heygen_image_keys';

/**
 * Generate a unique hash for a URL (collision-resistant)
 */
function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').substring(0, 40);
}

/**
 * Get cached image_key from Firestore
 */
async function getCachedImageKey(photoUrl: string): Promise<string | null> {
  try {
    const db = await getAdminDb();
    if (!db) return null;

    const urlHash = hashUrl(photoUrl);
    const docRef = db.collection(IMAGE_KEY_CACHE_COLLECTION).doc(urlHash);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      // Check if cache is still valid (7 days - image_keys don't expire quickly)
      const cacheAge = Date.now() - (data?.cachedAt || 0);
      if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
        console.log(`   💾 Using cached image_key for ${photoUrl.substring(0, 50)}...`);
        return data?.imageKey || null;
      }
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Error reading image_key cache:', error);
    return null;
  }
}

/**
 * Cache image_key in Firestore
 */
async function cacheImageKey(photoUrl: string, imageKey: string): Promise<void> {
  try {
    const db = await getAdminDb();
    if (!db) return;

    const urlHash = hashUrl(photoUrl);
    const docRef = db.collection(IMAGE_KEY_CACHE_COLLECTION).doc(urlHash);

    await docRef.set({
      photoUrl,
      imageKey,
      cachedAt: Date.now(),
    });

    console.log(`   💾 Cached image_key for future use`);
  } catch (error) {
    console.warn('⚠️ Error caching image_key:', error);
  }
}

/**
 * Upload an image asset to HeyGen for Avatar IV (with caching)
 * Returns the image_key needed for Avatar IV video generation
 * Checks cache first to avoid re-uploading the same image
 */
export async function uploadHeyGenAsset(
  imageUrl: string,
  brand: Brand
): Promise<{ success: boolean; image_key?: string; error?: string; cached?: boolean }> {
  try {
    // Check cache first
    const cachedKey = await getCachedImageKey(imageUrl);
    if (cachedKey) {
      return { success: true, image_key: cachedKey, cached: true };
    }

    console.log(`📤 [${brand}] Uploading image to HeyGen...`);

    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        `${HEYGEN_API_BASE}/v2/asset`,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': apiKeys.heygen,
          },
          body: JSON.stringify({
            url: imageUrl,
            type: 'image',
          }),
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error(`❌ HeyGen asset upload error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const imageKey = data.data?.id || data.id;

    if (!imageKey) {
      console.error('❌ HeyGen asset upload response missing id:', JSON.stringify(data));
      return { success: false, error: 'Asset upload response missing id' };
    }

    console.log(`✅ [${brand}] HeyGen asset uploaded: ${imageKey}`);

    // Cache for future use
    await cacheImageKey(imageUrl, imageKey);

    return { success: true, image_key: imageKey, cached: false };

  } catch (error) {
    console.error('❌ Error uploading HeyGen asset:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate video with Avatar IV API (more expressive with hand gestures)
 *
 * Avatar IV produces more natural, engaging videos with:
 * - Natural hand gestures
 * - Micro-expressions
 * - Head tilts and movements
 * - Better lip sync
 *
 * Note: Avatar IV has different credit costs (2:1 ratio with motion prompts)
 */
export async function generateAvatarIVVideo(
  request: AvatarIVVideoRequest,
  brand: Brand,
  workflowId?: string
): Promise<AvatarIVVideoResponse> {
  try {
    // 1. Check quota and budget BEFORE generating
    const quotaCheck = await checkHeyGenQuota(1, brand);

    if (!quotaCheck.allowed) {
      console.error(`❌ [${brand}] HeyGen quota check FAILED for Avatar IV`);
      console.error(`   Reason: ${quotaCheck.reason}`);

      return {
        success: false,
        error: `HeyGen quota insufficient: ${quotaCheck.reason}`,
      };
    }

    console.log(`✓ [${brand}] HeyGen quota check passed for Avatar IV`);

    // 2. Build the request
    const apiRequest: Record<string, any> = {
      image_key: request.image_key,
      script: request.script,
      voice_id: request.voice_id,
    };

    // Optional fields
    if (request.video_title) apiRequest.video_title = request.video_title;
    if (request.voice_speed) apiRequest.voice_speed = request.voice_speed; // Voice speed 0.5-1.5
    if (request.audio_url) apiRequest.audio_url = request.audio_url;
    if (request.audio_asset_id) apiRequest.audio_asset_id = request.audio_asset_id;
    if (request.callback_id) apiRequest.callback_id = request.callback_id;
    if (request.callback_url) apiRequest.callback_url = request.callback_url;

    // Motion prompts for hand gestures and expressions (keep under 2 clauses for best results)
    if (request.custom_motion_prompt) {
      apiRequest.custom_motion_prompt = request.custom_motion_prompt;
      // Default to true to let AI enhance the motion
      apiRequest.enhance_custom_motion_prompt = request.enhance_custom_motion_prompt ?? true;
    }

    // Dimension (default to vertical for social media)
    apiRequest.dimension = request.dimension || { width: 1080, height: 1920 };

    console.log(`🎬 [${brand}] Generating Avatar IV video with motion prompts...`);
    if (request.custom_motion_prompt) {
      console.log(`   Motion: ${request.custom_motion_prompt.substring(0, 50)}...`);
    }

    // 3. Call Avatar IV API
    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        `${HEYGEN_API_BASE}/v2/video/av4/generate`,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': apiKeys.heygen,
          },
          body: JSON.stringify(apiRequest),
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error(`❌ Avatar IV API error: ${errorMsg}`);

      return {
        success: false,
        error: `Avatar IV API error: ${errorMsg}`,
      };
    }

    const data = await response.json();
    const videoId = data.data?.video_id || data.video_id;

    if (!videoId) {
      console.error('❌ Avatar IV response missing video_id:', JSON.stringify(data));
      return {
        success: false,
        error: 'Avatar IV response missing video_id',
      };
    }

    console.log(`✅ [${brand}] Avatar IV video created: ${videoId}`);

    // 4. Track the cost (Avatar IV may have different costs)
    const cost = calculateHeyGenCost(1);
    await trackCost(
      brand,
      'heygen',
      'avatar_iv_generation',
      1,
      cost,
      workflowId,
      {
        video_id: videoId,
        dimensions: apiRequest.dimension,
        has_motion_prompt: !!request.custom_motion_prompt,
      }
    );

    // 5. Check for budget alerts
    await checkAndAlert('heygen', 'daily');

    return {
      success: true,
      video_id: videoId,
      data,
    };

  } catch (error) {
    console.error('❌ Error generating Avatar IV video:', error);
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
  generateAvatarIVVideo,
  uploadHeyGenAsset,
  getHeyGenVideoStatus,
  getHeyGenAvatars,
  getHeyGenVoices,
};
