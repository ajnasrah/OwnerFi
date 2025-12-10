/**
 * Video Hook Integration
 *
 * Integrates viral hooks into video generation for ALL brands.
 * Handles:
 * - Hook selection based on brand and content
 * - Video concatenation (hook + main video)
 * - FFmpeg processing for seamless transitions
 * - Hook performance tracking
 */

import { Brand } from '@/config/constants';
import { selectHook, markHookUsed, ViralHook, HookCategory, getHookTemplateForContent } from './viral-hooks';

// ============================================================================
// Configuration
// ============================================================================

// Brand-specific hook preferences
const BRAND_HOOK_CONFIG: Record<Brand, {
  preferredCategories: HookCategory[];
  preferredEmotion: string;
  useHooks: boolean;
  hookProbability: number; // 0-1, chance of adding hook
}> = {
  gaza: {
    preferredCategories: ['urgency', 'emotional', 'attention'],
    preferredEmotion: 'serious',
    useHooks: true,
    hookProbability: 0.8, // 80% of videos get hooks
  },
  ownerfi: {
    preferredCategories: ['educational', 'curiosity', 'attention'],
    preferredEmotion: 'excited',
    useHooks: true,
    hookProbability: 0.7,
  },
  carz: {
    preferredCategories: ['attention', 'curiosity', 'educational'],
    preferredEmotion: 'excited',
    useHooks: true,
    hookProbability: 0.7,
  },
  vassdistro: {
    preferredCategories: ['educational', 'attention', 'curiosity'],
    preferredEmotion: 'neutral',
    useHooks: true,
    hookProbability: 0.6,
  },
  abdullah: {
    preferredCategories: ['attention', 'educational', 'relatable'],
    preferredEmotion: 'excited',
    useHooks: true,
    hookProbability: 0.8,
  },
  property: {
    preferredCategories: ['attention', 'curiosity', 'urgency'],
    preferredEmotion: 'excited',
    useHooks: true,
    hookProbability: 0.7,
  },
  'property-spanish': {
    preferredCategories: ['attention', 'curiosity', 'urgency'],
    preferredEmotion: 'excited',
    useHooks: true,
    hookProbability: 0.7,
  },
  podcast: {
    preferredCategories: ['attention', 'curiosity'],
    preferredEmotion: 'neutral',
    useHooks: false, // Podcasts don't need hooks
    hookProbability: 0,
  },
  benefit: {
    preferredCategories: ['educational', 'attention'],
    preferredEmotion: 'neutral',
    useHooks: false,
    hookProbability: 0,
  },
  personal: {
    preferredCategories: ['relatable', 'attention', 'funny'],
    preferredEmotion: 'excited',
    useHooks: true,
    hookProbability: 0.9,
  },
};

// ============================================================================
// Hook Selection for Video Generation
// ============================================================================

export interface HookSelectionResult {
  hook: ViralHook | null;
  hookUrl: string | null;
  shouldUseHook: boolean;
  reason: string;
}

/**
 * Select a hook for video generation
 * Takes into account brand preferences and content matching
 */
export async function selectHookForVideo(
  brand: Brand,
  contentTitle: string,
  contentDescription?: string,
  forceHook?: boolean
): Promise<HookSelectionResult> {
  const config = BRAND_HOOK_CONFIG[brand];

  // Check if brand uses hooks
  if (!config.useHooks && !forceHook) {
    return {
      hook: null,
      hookUrl: null,
      shouldUseHook: false,
      reason: `Brand ${brand} has hooks disabled`
    };
  }

  // Random probability check
  if (!forceHook && Math.random() > config.hookProbability) {
    return {
      hook: null,
      hookUrl: null,
      shouldUseHook: false,
      reason: `Probability check failed (${config.hookProbability * 100}% chance)`
    };
  }

  // Determine best hook category based on content
  const content = `${contentTitle} ${contentDescription || ''}`;
  const { category } = getHookTemplateForContent(content, config.preferredCategories[0]);

  // Select hook
  const hook = await selectHook({
    brand,
    category,
    excludeRecentlyUsed: true,
    minPerformance: 0, // Don't filter by performance yet (new hooks won't have data)
  });

  if (!hook) {
    return {
      hook: null,
      hookUrl: null,
      shouldUseHook: false,
      reason: 'No matching hooks available'
    };
  }

  console.log(`🎣 Selected hook for ${brand}:`);
  console.log(`   ID: ${hook.id}`);
  console.log(`   Category: ${hook.category}`);
  console.log(`   Source: ${hook.source}`);
  console.log(`   Usage: ${hook.usageCount} times`);

  return {
    hook,
    hookUrl: hook.videoUrl,
    shouldUseHook: true,
    reason: `Selected ${hook.category} hook`
  };
}

// ============================================================================
// Video Concatenation
// ============================================================================

export interface ConcatResult {
  success: boolean;
  outputUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Concatenate hook video with main video
 * Uses FFmpeg via Cloud Function or external service
 */
export async function concatenateHookWithVideo(
  hookUrl: string,
  mainVideoUrl: string,
  outputPath: string
): Promise<ConcatResult> {
  const startTime = Date.now();

  try {
    console.log('🎬 Concatenating hook with main video...');
    console.log(`   Hook: ${hookUrl}`);
    console.log(`   Main: ${mainVideoUrl}`);

    // Option 1: Use a Cloud Function with FFmpeg
    // Option 2: Use a video processing service like Creatomate or Shotstack
    // Option 3: Use Submagic's video editing capabilities

    // For now, we'll use a placeholder that calls an external service
    // You can implement this with:
    // - AWS Lambda with FFmpeg layer
    // - Google Cloud Functions with FFmpeg
    // - Creatomate API
    // - Shotstack API

    const VIDEO_CONCAT_API = process.env.VIDEO_CONCAT_API_URL;

    if (!VIDEO_CONCAT_API) {
      console.log('⚠️  VIDEO_CONCAT_API_URL not configured - skipping concatenation');
      // Return the main video without hook
      return {
        success: true,
        outputUrl: mainVideoUrl,
        processingTimeMs: Date.now() - startTime
      };
    }

    const response = await fetch(VIDEO_CONCAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videos: [hookUrl, mainVideoUrl],
        output: outputPath,
        transition: 'cut', // or 'fade', 'dissolve'
      })
    });

    if (!response.ok) {
      throw new Error(`Concat API error: ${response.status}`);
    }

    const result = await response.json();

    return {
      success: true,
      outputUrl: result.outputUrl,
      processingTimeMs: Date.now() - startTime
    };

  } catch (error) {
    console.error('❌ Error concatenating videos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime
    };
  }
}

// ============================================================================
// High-Level Integration
// ============================================================================

export interface VideoWithHookResult {
  finalVideoUrl: string;
  hookUsed: boolean;
  hookId?: string;
  hookCategory?: string;
}

/**
 * Process video with optional hook
 * Call this after HeyGen video is ready but before posting
 */
export async function addHookToVideo(
  brand: Brand,
  workflowId: string,
  mainVideoUrl: string,
  contentTitle: string,
  contentDescription?: string
): Promise<VideoWithHookResult> {
  console.log(`\n🎣 Processing video hook for ${brand}...`);

  // Select appropriate hook
  const hookResult = await selectHookForVideo(brand, contentTitle, contentDescription);

  if (!hookResult.shouldUseHook || !hookResult.hook) {
    console.log(`⏭️  Skipping hook: ${hookResult.reason}`);
    return {
      finalVideoUrl: mainVideoUrl,
      hookUsed: false
    };
  }

  // Track hook usage
  await markHookUsed(hookResult.hook.id, workflowId, brand);

  // Concatenate videos
  const outputPath = `${brand}/videos/${workflowId}_with_hook.mp4`;
  const concatResult = await concatenateHookWithVideo(
    hookResult.hookUrl!,
    mainVideoUrl,
    outputPath
  );

  if (!concatResult.success) {
    console.log(`⚠️  Hook concatenation failed - using original video`);
    return {
      finalVideoUrl: mainVideoUrl,
      hookUsed: false
    };
  }

  console.log(`✅ Hook added successfully!`);
  console.log(`   Output: ${concatResult.outputUrl}`);
  console.log(`   Processing time: ${concatResult.processingTimeMs}ms`);

  return {
    finalVideoUrl: concatResult.outputUrl || mainVideoUrl,
    hookUsed: true,
    hookId: hookResult.hook.id,
    hookCategory: hookResult.hook.category
  };
}

// ============================================================================
// Text-Based Hooks (Alternative for HeyGen)
// ============================================================================

/**
 * Get a text hook to prepend to video script
 * Use this when you want HeyGen to speak the hook instead of using a video clip
 */
export function getTextHookForScript(
  brand: Brand,
  contentTitle: string
): { hookText: string; category: HookCategory } {
  const config = BRAND_HOOK_CONFIG[brand];
  const { category, template } = getHookTemplateForContent(contentTitle, config.preferredCategories[0]);

  return {
    hookText: template,
    category
  };
}

/**
 * Prepend hook text to video script
 */
export function prependHookToScript(script: string, hookText: string): string {
  // Add a pause after the hook for dramatic effect
  return `${hookText}... ${script}`;
}
