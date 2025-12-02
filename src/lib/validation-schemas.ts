// API Validation Schemas
// Centralized Zod schemas for all API endpoints

import { z } from 'zod';
import { BRANDS, PLATFORMS } from '@/config/constants';

// ============================================================================
// BRAND & PLATFORM SCHEMAS
// ============================================================================

export const BrandSchema = z.enum(BRANDS.VALID_BRANDS);
export type Brand = z.infer<typeof BrandSchema>;

export const PlatformSchema = z.enum(PLATFORMS.VALID_PLATFORMS);
export type Platform = z.infer<typeof PlatformSchema>;

export const PostTypeSchema = z.enum(['reels', 'story', 'post', 'video']);
export type PostType = z.infer<typeof PostTypeSchema>;

// ============================================================================
// WORKFLOW SCHEMAS
// ============================================================================

export const CompleteWorkflowRequestSchema = z.object({
  workflowId: z.string().optional(),  // Optional: if provided, resume existing workflow instead of creating new one
  brand: BrandSchema,
  platforms: z.array(PlatformSchema).optional().default(['instagram', 'tiktok', 'youtube']),
  schedule: z.enum(['immediate', '1hour', '2hours', '4hours', 'optimal']).optional().default('immediate'),
  talking_photo_id: z.string().optional(),  // For talking photo avatars (user's face photos)
  avatar_id: z.string().optional(),  // For studio avatars (HeyGen's pre-built avatars with backgrounds)
  voice_id: z.string().optional(),
});

export type CompleteWorkflowRequest = z.infer<typeof CompleteWorkflowRequestSchema>;

// ============================================================================
// HEYGEN SCHEMAS
// ============================================================================

export const HeyGenVideoRequestSchema = z.object({
  talking_photo_id: z.string().min(1, 'Talking photo ID required'),
  voice_id: z.string().min(1, 'Voice ID required'),
  input_text: z.string().min(10, 'Script must be at least 10 characters').max(3000, 'Script too long'),
  scale: z.number().min(0.5).max(2.0).default(1.4),
  width: z.number().int().min(360).max(3840).default(1080),
  height: z.number().int().min(360).max(3840).default(1920),
  callback_id: z.string().optional(),
});

export type HeyGenVideoRequest = z.infer<typeof HeyGenVideoRequestSchema>;

// ============================================================================
// SUBMAGIC SCHEMAS
// ============================================================================

export const SubmagicProjectRequestSchema = z.object({
  videoUrl: z.string().url('Video URL must be valid'),
  title: z.string().min(1).max(100, 'Title too long'),
  language: z.string().length(2, 'Language must be 2-letter ISO code').default('en'),
  templateName: z.string().default('Hormozi 2'),
  magicBrolls: z.boolean().default(true),
  magicBrollsPercentage: z.number().min(0).max(100).default(50),
  magicZooms: z.boolean().default(true),
  webhookUrl: z.string().url().optional(),
});

export type SubmagicProjectRequest = z.infer<typeof SubmagicProjectRequestSchema>;

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

export const HeyGenWebhookSchema = z.object({
  event_type: z.string(),
  event_data: z.object({
    video_id: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    video_url: z.string().url().optional(),
    thumbnail_url: z.string().url().optional(),
    error: z.string().optional(),
  }),
  callback_id: z.string().optional(),
  timestamp: z.string().optional(),
});

export type HeyGenWebhook = z.infer<typeof HeyGenWebhookSchema>;

export const SubmagicWebhookSchema = z.object({
  projectId: z.string().optional(),
  id: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'done', 'ready', 'failed', 'error']),
  downloadUrl: z.string().url().optional(),
  media_url: z.string().url().optional(),
  mediaUrl: z.string().url().optional(),
  video_url: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  download_url: z.string().url().optional(),
  timestamp: z.string().optional(),
});

export type SubmagicWebhook = z.infer<typeof SubmagicWebhookSchema>;

// ============================================================================
// ARTICLE SCHEMAS
// ============================================================================

export const ArticleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title required'),
  content: z.string().min(1, 'Content required'),
  description: z.string().optional(),
  link: z.string().url('Invalid article URL'),
  pubDate: z.number().int().positive(),
  source: z.string().optional(),
  feedId: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  processed: z.boolean().default(false),
  locked: z.boolean().default(false),
  lockedAt: z.number().optional(),
  lockedBy: z.string().optional(),
});

export type Article = z.infer<typeof ArticleSchema>;

// ============================================================================
// PODCAST SCHEMAS
// ============================================================================

export const PodcastEpisodeSchema = z.object({
  episodeNumber: z.number().int().positive(),
  episodeTitle: z.string().min(1, 'Episode title required').max(200, 'Title too long'),
  script: z.string().min(10, 'Script too short').max(5000, 'Script too long'),
  talking_photo_id: z.string().optional(),
  voice_id: z.string().optional(),
});

export type PodcastEpisode = z.infer<typeof PodcastEpisodeSchema>;

// ============================================================================
// CRON AUTH SCHEMA
// ============================================================================

export const CronAuthSchema = z.object({
  authorization: z.string().startsWith('Bearer '),
  'x-vercel-cron': z.enum(['1']).optional(),
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safe parse with detailed error messages
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map(err => {
      const path = err.path.join('.');
      return path ? `${path}: ${err.message}` : err.message;
    }),
  };
}

/**
 * Validate and return data, throw on error
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
      });
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    throw error;
  }
}
