/**
 * Creatify API Client
 *
 * Replaces HeyGen + Synthesia + Submagic with a single service.
 * Uses AI Avatar v2 API for multi-scene videos with built-in captions.
 *
 * API Reference:
 * - Create video:   POST https://api.creatify.ai/api/lipsyncs_v2/
 * - Get status:     GET  https://api.creatify.ai/api/lipsyncs_v2/{id}/
 * - List personas:  GET  https://api.creatify.ai/api/personas/
 * - List voices:    GET  https://api.creatify.ai/api/voices/
 * - Check credits:  GET  https://api.creatify.ai/api/remaining_credits/
 * - Auth: X-API-ID + X-API-KEY headers
 *
 * Credit costs:
 * - AI Avatar v1/v2: 5 credits per 30 seconds
 * - Aurora: 20 credits per 15 seconds (premium)
 * - TTS only: 1 credit per 30 seconds
 * - GET endpoints: free
 */

import { Brand, TIMEOUTS } from '@/config/constants';
import { fetchWithTimeout } from './api-utils';

const CREATIFY_API_BASE = 'https://api.creatify.ai/api';

// ============================================================================
// Types
// ============================================================================

export interface CreatifySceneInput {
  character: {
    type: 'avatar';
    avatar_id: string;
    avatar_style?: string;
    scale?: number;
    offset?: { x: number; y: number };
    hidden?: boolean;
  };
  voice: {
    type: 'text';
    input_text: string;
    voice_id: string;
    volume?: number;
  };
  background?: {
    type: 'image' | 'video';
    url: string;
    fit?: 'crop' | 'contain' | 'cover';
    effect?: string | null;
  };
  caption_setting?: {
    style?: string;
    offset?: { x: number; y: number };
    font_family?: string;
    font_size?: number;
    font_style?: string | null;
    background_color?: string | null;
    text_color?: string | null;
    highlight_text_color?: string | null;
    max_width?: number | null;
    line_height?: number | null;
    text_shadow?: string | null;
    hidden?: boolean;
  };
  transition_effect?: {
    transition_in?: string | null;
    transition_out?: string | null;
  };
  visual_style?: string | null;
}

export interface CreatifyV2Request {
  video_inputs: CreatifySceneInput[];
  aspect_ratio: '9x16' | '16x9' | '1x1';
  model_version?: string;
  webhook_url?: string;
  name?: string;
}

export interface CreatifyVideoResponse {
  success: boolean;
  video_id?: string;
  error?: string;
  credits_used?: number;
  data?: any;
}

export interface CreatifyVideoStatus {
  id: string;
  status: 'pending' | 'done' | 'failed';
  output?: string; // S3 URL to finished video
  video_thumbnail?: string;
  progress?: number;
  credits_used?: number;
  failed_reason?: string | null;
}

export interface CreatifyPersona {
  id: string;
  persona_name?: string;
  creator_name?: string;
  thumbnail_url?: string;
  gender?: string;
  is_active?: boolean;
}

export interface CreatifyVoice {
  id: string;
  name: string;
  gender?: string;
  accents?: Array<{
    id: string;
    accent_name: string;
    preview_url?: string;
  }>;
}

export interface CreatifyCredits {
  remaining_credits: number;
}

// ============================================================================
// Auth Headers
// ============================================================================

function getCreatifyHeaders(): Record<string, string> {
  const apiId = process.env.CREATIFY_API_ID;
  const apiKey = process.env.CREATIFY_API_KEY;

  if (!apiId || !apiKey) {
    throw new Error('CREATIFY_API_ID and CREATIFY_API_KEY must be configured');
  }

  return {
    'X-API-ID': apiId.trim(),
    'X-API-KEY': apiKey.trim(),
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Credit Checking
// ============================================================================

/**
 * Check remaining Creatify credits
 * Unlike HeyGen's broken quota API, this actually works reliably.
 */
export async function checkCredits(): Promise<CreatifyCredits> {
  const response = await fetchWithTimeout(
    `${CREATIFY_API_BASE}/remaining_credits/`,
    { method: 'GET', headers: getCreatifyHeaders() },
    TIMEOUTS.EXTERNAL_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Creatify credits check failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Pre-generation credit check
 * Estimates credits needed and verifies we can afford it.
 */
export async function canAffordVideo(
  estimatedSeconds: number = 45
): Promise<{ allowed: boolean; remaining: number; needed: number; reason?: string }> {
  try {
    const { remaining_credits } = await checkCredits();
    // 5 credits per 30 seconds, rounded up
    const needed = Math.ceil(estimatedSeconds / 30) * 5;

    if (remaining_credits < needed) {
      return {
        allowed: false,
        remaining: remaining_credits,
        needed,
        reason: `Need ${needed} credits but only ${remaining_credits} remaining`,
      };
    }

    return { allowed: true, remaining: remaining_credits, needed };
  } catch (error) {
    // Fail-open: credit check errors should NOT block video generation
    console.error('Error checking Creatify credits (proceeding anyway):', error);
    return {
      allowed: true,
      remaining: -1,
      needed: 0,
      reason: `Credit check failed (proceeding): ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// Video Generation (AI Avatar v2 — multi-scene)
// ============================================================================

/**
 * Generate a multi-scene video with Creatify AI Avatar v2.
 * Each scene can have its own avatar, voice, background, and caption style.
 */
export async function generateVideo(
  request: CreatifyV2Request,
  brand: Brand,
  workflowId?: string
): Promise<CreatifyVideoResponse> {
  try {
    // 1. Check credits
    const creditCheck = await canAffordVideo(45);
    if (!creditCheck.allowed) {
      console.error(`[${brand}] Creatify credit check FAILED: ${creditCheck.reason}`);
      return {
        success: false,
        error: `Creatify credits insufficient: ${creditCheck.reason}`,
      };
    }

    console.log(`[${brand}] Creatify credit check passed (${creditCheck.remaining} remaining, need ~${creditCheck.needed})`);

    // 2. Call Creatify API
    console.log(`[${brand}] Generating Creatify v2 video (${request.video_inputs.length} scenes)...`);

    const response = await fetchWithTimeout(
      `${CREATIFY_API_BASE}/lipsyncs_v2/`,
      {
        method: 'POST',
        headers: getCreatifyHeaders(),
        body: JSON.stringify(request),
      },
      TIMEOUTS.EXTERNAL_API
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.detail || errorData.error || errorData.message || `HTTP ${response.status}`;
      console.error(`Creatify API error: ${errorMsg}`, JSON.stringify(errorData));
      return { success: false, error: `Creatify API error: ${errorMsg}` };
    }

    const data = await response.json();
    const videoId = data.id;

    if (!videoId) {
      console.error('Creatify response missing video id:', JSON.stringify(data));
      return { success: false, error: 'Creatify response missing video id' };
    }

    console.log(`[${brand}] Creatify video created: ${videoId}`);

    // 3. Track cost
    try {
      const { trackCost } = await import('./cost-tracker');
      const estimatedCredits = Math.ceil(45 / 30) * 5; // ~10 credits for 45 sec
      await trackCost(
        brand,
        'creatify',
        'video_generation',
        estimatedCredits,
        0, // Cost TBD based on enterprise pricing
        workflowId,
        { video_id: videoId, scenes: request.video_inputs.length }
      );
    } catch (costError) {
      console.error('Failed to track Creatify cost:', costError);
    }

    return {
      success: true,
      video_id: videoId,
      credits_used: data.credits_used,
      data,
    };
  } catch (error) {
    console.error('Error generating Creatify video:', error);
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
 * Get Creatify video generation status.
 * Poll this until status is 'done' or 'failed'.
 */
export async function getVideoStatus(videoId: string): Promise<CreatifyVideoStatus> {
  const response = await fetchWithTimeout(
    `${CREATIFY_API_BASE}/lipsyncs_v2/${videoId}/`,
    { method: 'GET', headers: getCreatifyHeaders() },
    TIMEOUTS.EXTERNAL_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Creatify status API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    output: data.output,
    video_thumbnail: data.video_thumbnail,
    progress: data.progress,
    credits_used: data.credits_used,
    failed_reason: data.failed_reason,
  };
}

// ============================================================================
// Persona & Voice Discovery (free — no credits)
// ============================================================================

/**
 * List available avatars/personas.
 * Use this to browse and select avatars for each brand.
 */
export async function listPersonas(page: number = 1): Promise<{
  results: CreatifyPersona[];
  count: number;
  next: string | null;
}> {
  const response = await fetchWithTimeout(
    `${CREATIFY_API_BASE}/personas/?page=${page}`,
    { method: 'GET', headers: getCreatifyHeaders() },
    TIMEOUTS.EXTERNAL_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Creatify personas API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get a specific persona by ID.
 */
export async function getPersona(personaId: string): Promise<CreatifyPersona> {
  const response = await fetchWithTimeout(
    `${CREATIFY_API_BASE}/personas/${personaId}/`,
    { method: 'GET', headers: getCreatifyHeaders() },
    TIMEOUTS.EXTERNAL_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Creatify persona API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * List available voices and accents.
 * Each voice has an accents array — use accent.id as the voice_id in video requests.
 */
export async function listVoices(): Promise<CreatifyVoice[]> {
  const response = await fetchWithTimeout(
    `${CREATIFY_API_BASE}/voices/`,
    { method: 'GET', headers: getCreatifyHeaders() },
    TIMEOUTS.EXTERNAL_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Creatify voices API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// Exports
// ============================================================================

export default {
  checkCredits,
  canAffordVideo,
  generateVideo,
  getVideoStatus,
  listPersonas,
  getPersona,
  listVoices,
};
