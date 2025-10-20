// System-wide constants and configuration values
// Centralizes all hardcoded values for better maintainability

// ============================================================================
// TIME CONSTANTS
// ============================================================================

export const TIME = {
  ONE_MINUTE: 60_000,
  ONE_HOUR: 3_600_000,
  ONE_DAY: 86_400_000,
  SEVEN_DAYS: 604_800_000,
} as const;

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

export const TIMEOUTS = {
  // External API timeouts
  EXTERNAL_API: 30_000, // 30 seconds
  HEYGEN_API: 30_000,
  SUBMAGIC_API: 30_000,
  LATE_API: 30_000,
  OPENAI_API: 60_000, // 60 seconds for AI generation
  RSS_FETCH: 30_000, // 30 seconds for RSS feed fetching

  // Polling timeouts
  HEYGEN_POLL: 45_000, // 45 seconds per poll
  SUBMAGIC_POLL: 45_000,

  // Maximum workflow duration
  MAX_WORKFLOW: 10_800_000, // 3 hours

  // Webhook response timeout
  WEBHOOK_RESPONSE: 5_000, // Must respond within 5s
} as const;

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export const RETRY = {
  // Default retry attempts
  DEFAULT_ATTEMPTS: 3,

  // HeyGen specific
  HEYGEN_STATUS_ATTEMPTS: 30, // ~22.5 minutes
  HEYGEN_WEBHOOK_ATTEMPTS: 14, // ~20 minutes

  // Submagic specific
  SUBMAGIC_STATUS_ATTEMPTS: 30,
  SUBMAGIC_WEBHOOK_ATTEMPTS: 14,

  // Backoff strategy
  BACKOFF_BASE: 1000, // 1 second
  BACKOFF_MAX: 60_000, // 1 minute max
} as const;

// ============================================================================
// VIDEO SETTINGS
// ============================================================================

export const VIDEO = {
  // Storage duration
  AUTO_DELETE_DAYS: 7,

  // Size limits
  MAX_SIZE_MB: 500,
  MAX_SIZE_BYTES: 500 * 1024 * 1024,

  // Submagic settings
  SUBMAGIC_TEMPLATE: 'Hormozi 2',
  SUBMAGIC_ASPECT_RATIO: '9:16',

  // HeyGen settings
  HEYGEN_QUALITY: 'high' as const,
} as const;

// ============================================================================
// QUALITY THRESHOLDS
// ============================================================================

export const QUALITY = {
  // Article quality scoring
  MIN_ARTICLE_QUALITY: 50, // Minimum score to proceed
  TARGET_ARTICLE_QUALITY: 100, // Target score for high quality

  // Content length
  MIN_CONTENT_LENGTH: 200, // Minimum article length in characters
  MAX_SCRIPT_LENGTH: 2000, // Maximum script length for video
} as const;

// ============================================================================
// SCHEDULING CONFIGURATION
// ============================================================================

export const SCHEDULE = {
  // Posting time slots (Eastern Time)
  POSTING_HOURS: [9, 11, 14, 18, 20] as const,

  // Timezone
  TIMEZONE: 'America/New_York',

  // Immediate post delay (to avoid conflicts)
  IMMEDIATE_DELAY: 60_000, // 1 minute
} as const;

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================
//
// NOTE: These are conservative estimates based on available documentation.
// Actual API rate limits may vary by plan tier.
//
// Documented Limits:
// - Submagic: 50/hour (exports), 500/hour (uploads/standard), 1000/hour (lightweight)
// - OpenAI: Varies by model and tier (60 RPM is typical for basic tier)
// - HeyGen: Not publicly documented, varies by plan (Free: 1 concurrent, Pro: 3, Scale: 6)
// - Late API: Not publicly documented
//
// Our settings are intentionally conservative to avoid hitting limits.

export const RATE_LIMITS = {
  // Late API (replaces Metricool)
  LATE_REQUESTS_PER_MINUTE: 60,
  LATE_REQUESTS_PER_HOUR: 1000,

  // HeyGen (plan-dependent, conservative estimate)
  // NOTE: HeyGen uses concurrent video limits, not per-minute rate limits
  HEYGEN_REQUESTS_PER_MINUTE: 30,
  HEYGEN_CONCURRENT_VIDEOS: 5, // Typical for Scale plan

  // Submagic (documented: 50-1000/hour depending on operation type)
  // We primarily use project creation (upload operation) = 500/hour limit
  // 8 req/min = 480/hour (stays safely under 500/hour limit)
  SUBMAGIC_REQUESTS_PER_MINUTE: 8,

  // OpenAI (documented, varies by tier and model)
  // Basic tier: typically 60 RPM, 90k TPM for gpt-4o-mini
  OPENAI_REQUESTS_PER_MINUTE: 60,
  OPENAI_TOKENS_PER_MINUTE: 90_000,

  // Circuit breaker thresholds (prevents cascading failures)
  CIRCUIT_BREAKER_THRESHOLD: 5, // failures before opening circuit
  CIRCUIT_BREAKER_TIMEOUT: 60_000, // 1 minute cooldown before retry
} as const;

// ============================================================================
// WORKFLOW CONFIGURATION
// ============================================================================

export const WORKFLOW = {
  // Status check intervals
  STUCK_THRESHOLD_MINUTES: 30, // Consider workflow stuck after 30 min

  // Cleanup intervals
  CLEANUP_INTERVAL_DAYS: 7, // Clean up old videos every 7 days

  // Batch sizes
  MAX_BATCH_SIZE: 10, // Max workflows to process at once

  // Priority levels
  PRIORITY: {
    HIGH: 1,
    NORMAL: 5,
    LOW: 10,
  } as const,
} as const;

// ============================================================================
// BRAND CONFIGURATION
// ============================================================================

export const BRANDS = {
  VALID_BRANDS: ['carz', 'ownerfi', 'podcast', 'benefit'] as const,
} as const;

export type Brand = typeof BRANDS.VALID_BRANDS[number];

// ============================================================================
// PLATFORM CONFIGURATION
// ============================================================================

export const PLATFORMS = {
  VALID_PLATFORMS: [
    'instagram',
    'tiktok',
    'youtube',
    'facebook',
    'linkedin',
    'threads',
    'twitter'
  ] as const,

  // Default posting platforms
  DEFAULT_REELS_PLATFORMS: ['instagram', 'tiktok', 'youtube'] as const,
} as const;

export type Platform = typeof PLATFORMS.VALID_PLATFORMS[number];

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  // API errors
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please try again later.',
  API_TIMEOUT: 'API request timed out. Please try again.',
  API_UNAVAILABLE: 'External API is currently unavailable.',

  // Validation errors
  INVALID_BRAND: 'Invalid brand specified. Must be: carz, ownerfi, or podcast',
  INVALID_PLATFORM: 'Invalid platform specified.',
  MISSING_REQUIRED_FIELD: 'Missing required field in request.',

  // Workflow errors
  WORKFLOW_NOT_FOUND: 'Workflow not found.',
  WORKFLOW_ALREADY_PROCESSING: 'Workflow is already being processed.',
  WORKFLOW_STUCK: 'Workflow appears to be stuck.',

  // Video errors
  VIDEO_DOWNLOAD_FAILED: 'Failed to download video.',
  VIDEO_UPLOAD_FAILED: 'Failed to upload video.',
  VIDEO_TOO_LARGE: 'Video file exceeds maximum size limit.',

  // Content errors
  ARTICLE_QUALITY_TOO_LOW: 'Article quality score is below minimum threshold.',
  CONTENT_TOO_SHORT: 'Article content is too short to generate video.',
  PROMPT_INJECTION_DETECTED: 'Potentially malicious content detected in input.',
} as const;

// ============================================================================
// CRON JOB CONFIGURATION
// ============================================================================

export const CRON = {
  // Job schedules (cron syntax)
  CHECK_STUCK_SUBMAGIC: '*/15 * * * *', // Every 15 minutes
  CHECK_STUCK_HEYGEN: '*/15 * * * *', // Every 15 minutes
  CLEANUP_VIDEOS: '0 3 * * *', // Daily at 3 AM
  CLEANUP_FAILED_WORKFLOWS: '0 4 * * *', // Daily at 4 AM

  // Execution limits
  MAX_EXECUTION_TIME: 300_000, // 5 minutes max per cron
} as const;

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

export const LOGGING = {
  // Log levels
  LEVEL: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
  } as const,

  // Feature flags
  ENABLE_PERFORMANCE_LOGS: process.env.NODE_ENV === 'development',
  ENABLE_DEBUG_LOGS: process.env.NODE_ENV === 'development',
} as const;

// ============================================================================
// YOUTUBE CATEGORIES
// ============================================================================

export const YOUTUBE_CATEGORIES = {
  CARZ: 'AUTOS_VEHICLES',
  OWNERFI: 'NEWS_POLITICS',
  PODCAST: 'NEWS_POLITICS',
} as const;

// ============================================================================
// SECURITY
// ============================================================================

export const SECURITY = {
  // Prompt injection patterns to block
  SUSPICIOUS_PATTERNS: [
    /ignore\s+previous\s+instructions/gi,
    /ignore\s+all\s+previous/gi,
    /disregard\s+previous/gi,
    /forget\s+previous/gi,
    /system\s*:\s*you\s+are/gi,
    /new\s+instructions/gi,
  ] as const,

  // Max content lengths
  MAX_ARTICLE_CONTENT: 10_000,
  MAX_USER_INPUT: 5_000,
} as const;
