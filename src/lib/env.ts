// Environment Variable Validation
// Validates all required environment variables at startup with Zod

import { z } from 'zod';

// Define environment variable schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Base URLs
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),

  // Firebase
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().min(1, 'Firebase service account key is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),

  // External APIs - Required
  HEYGEN_API_KEY: z.string().min(1, 'HeyGen API key is required'),
  SUBMAGIC_API_KEY: z.string().min(1, 'Submagic API key is required'),
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),

  // HeyGen Webhook Secrets (brand-specific, optional but recommended)
  HEYGEN_WEBHOOK_SECRET_CARZ: z.string().optional(),
  HEYGEN_WEBHOOK_SECRET_OWNERFI: z.string().optional(),
  HEYGEN_WEBHOOK_SECRET_PODCAST: z.string().optional(),

  // GetLate API - Social Media Publishing (replaces Metricool)
  LATE_API_KEY: z.string().min(1, 'GetLate API key is required'),
  LATE_OWNERFI_PROFILE_ID: z.string().min(1, 'GetLate OwnerFi profile ID is required'),
  LATE_CARZ_PROFILE_ID: z.string().min(1, 'GetLate Carz profile ID is required'),
  LATE_PODCAST_PROFILE_ID: z.string().min(1, 'GetLate Podcast profile ID is required'),

  // Metricool (Legacy - kept for backwards compatibility, optional)
  METRICOOL_API_KEY: z.string().optional(),
  METRICOOL_USER_ID: z.string().optional(),
  METRICOOL_CARZ_BRAND_ID: z.string().optional(),
  METRICOOL_OWNERFI_BRAND_ID: z.string().optional(),
  METRICOOL_PODCAST_BRAND_ID: z.string().optional(),

  // Cloudflare R2 Storage
  R2_ACCOUNT_ID: z.string().min(1, 'R2 account ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2 access key ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2 secret access key is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2 bucket name is required'),
  R2_PUBLIC_DOMAIN: z.string().url().optional(),

  // Authentication & Security
  CRON_SECRET: z.string().min(1, 'Cron secret is required'),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Error Monitoring (optional)
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // Stripe (optional - for realtor platform)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Feature Flags
  ENABLE_AUTO_POSTING: z.string().optional().transform(val => val === 'true'),
  ENABLE_VIDEO_CLEANUP: z.string().optional().transform(val => val !== 'false'),
});

// Type inference from schema
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * This should be called at app startup
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach(err => {
        console.error(`   ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid environment variables. Check console for details.');
    }
    throw error;
  }
}

/**
 * Get validated environment variables
 * Throws if validation fails
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

/**
 * Check if all required environment variables are present
 * Returns validation result without throwing
 */
export function checkEnv(): { valid: boolean; errors: string[] } {
  try {
    envSchema.parse(process.env);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

// Validate on module load in production
if (process.env.NODE_ENV === 'production') {
  try {
    validateEnv();
  } catch (error) {
    console.error('❌ FATAL: Environment validation failed in production');
    // Don't throw in production, let the app handle missing vars gracefully
    // throw error;
  }
}
