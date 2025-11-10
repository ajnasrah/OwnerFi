/**
 * Centralized Environment Configuration with Validation
 *
 * This module provides type-safe access to all environment variables
 * and validates them at startup to catch configuration issues early.
 *
 * Benefits:
 * - Single source of truth for all environment variables
 * - Type safety (no more string | undefined checks everywhere)
 * - Startup validation (fail fast if config is missing)
 * - Easy to mock for testing
 * - Clear documentation of all required variables
 */

// Environment variable validation helper
function requireEnv(key: string, description?: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    const errorMsg = description
      ? `Missing required environment variable: ${key} (${description})`
      : `Missing required environment variable: ${key}`;

    // During build, test, or in development, warn instead of throwing
    const isNonProd = process.env.NODE_ENV !== 'production' ||
                      process.env.NEXT_PHASE === 'phase-production-build' ||
                      process.env.npm_lifecycle_event === 'test';

    if (isNonProd) {
      // Only warn once per key to avoid spam
      if (!warnedKeys.has(key)) {
        console.warn(`⚠️  ${errorMsg}`);
        warnedKeys.add(key);
      }
      return '';
    }

    throw new Error(errorMsg);
  }
  return value;
}

// Track which keys we've warned about
const warnedKeys = new Set<string>();

function optionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

function requireEnvUrl(key: string, description?: string): string {
  const value = requireEnv(key, description);

  // Validate URL format
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`Invalid URL format for ${key}: ${value}`);
  }
}

// API Keys Configuration with lazy evaluation (prevents stale keys in serverless)
// Uses getters to read env vars fresh on each access
export const apiKeys = {
  // HeyGen - Video Generation ($330/month for 660 credits)
  get heygen() { return requireEnv('HEYGEN_API_KEY', 'HeyGen video generation API key'); },
  get heygenWebhookSecret() { return optionalEnv('HEYGEN_WEBHOOK_SECRET'); },

  // Submagic - Caption Generation ($150/month for 600 credits)
  get submagic() { return requireEnv('SUBMAGIC_API_KEY', 'Submagic caption generation API key'); },
  get submagicWebhookSecret() { return optionalEnv('SUBMAGIC_WEBHOOK_SECRET'); },

  // Late - Social Media Posting ($50/month unlimited)
  get late() { return requireEnv('LATE_API_KEY', 'Late social media posting API key'); },

  // OpenAI - Script Generation
  get openai() { return requireEnv('OPENAI_API_KEY', 'OpenAI GPT script generation API key'); },

  // ElevenLabs - Voice Synthesis (optional)
  get elevenlabs() { return optionalEnv('ELEVENLABS_API_KEY'); },

  // Google Maps - Location Services
  get googleMaps() { return optionalEnv('GOOGLE_MAPS_API_KEY'); },

  // Stripe - Payment Processing
  stripe: {
    get secretKey() { return optionalEnv('STRIPE_SECRET_KEY'); },
    get publishableKey() { return optionalEnv('STRIPE_PUBLISHABLE_KEY'); },
    get webhookSecret() { return optionalEnv('STRIPE_WEBHOOK_SECRET'); },
  },

  // GoHighLevel - CRM Integration
  goHighLevel: {
    get apiKey() { return optionalEnv('GOHIGHLEVEL_API_KEY'); },
    get locationId() { return optionalEnv('GOHIGHLEVEL_LOCATION_ID'); },
  },
};

// Late API Profile IDs (one per brand) - lazy evaluation
export const lateProfiles = {
  get carz() { return optionalEnv('LATE_CARZ_PROFILE_ID'); },
  get ownerfi() { return optionalEnv('LATE_OWNERFI_PROFILE_ID'); },
  get podcast() { return optionalEnv('LATE_PODCAST_PROFILE_ID'); },
  get vassdistro() { return optionalEnv('LATE_VASSDISTRO_PROFILE_ID'); },
  get abdullah() { return optionalEnv('LATE_ABDULLAH_PROFILE_ID'); },
};

// Firebase Configuration
export const firebase = {
  // Client-side Firebase (public)
  apiKey: requireEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'Firebase API key'),
  authDomain: requireEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'Firebase auth domain'),
  projectId: requireEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'Firebase project ID'),
  storageBucket: requireEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'Firebase storage bucket'),
  messagingSenderId: requireEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'Firebase messaging sender ID'),
  appId: requireEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'Firebase app ID'),

  // Server-side Firebase Admin (private)
  serviceAccountKey: optionalEnv('FIREBASE_SERVICE_ACCOUNT_KEY'), // JSON string
  databaseUrl: optionalEnv('FIREBASE_DATABASE_URL'),
};

// Cloudflare R2 Storage Configuration
export const cloudflare = {
  r2: {
    accountId: requireEnv('R2_ACCOUNT_ID', 'Cloudflare account ID') || requireEnv('CLOUDFLARE_ACCOUNT_ID', 'Cloudflare account ID'),
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID', 'Cloudflare R2 access key') || requireEnv('CLOUDFLARE_R2_ACCESS_KEY_ID', 'Cloudflare R2 access key'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY', 'Cloudflare R2 secret key') || requireEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'Cloudflare R2 secret key'),
    bucketName: requireEnv('R2_BUCKET_NAME', 'Cloudflare R2 bucket name') || requireEnv('CLOUDFLARE_R2_BUCKET_NAME', 'Cloudflare R2 bucket name'),
    publicUrl: requireEnv('R2_PUBLIC_URL', 'Cloudflare R2 public URL') || requireEnv('CLOUDFLARE_R2_PUBLIC_URL', 'Cloudflare R2 public URL'),
  },
};

// Application Configuration
export const app = {
  // Base URL for webhooks and callbacks
  baseUrl: (() => {
    const url = optionalEnv('NEXT_PUBLIC_BASE_URL') ||
                (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://ownerfi.ai');

    // Warn if not HTTPS in production
    if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
      console.warn(`⚠️  BASE_URL should use HTTPS in production: ${url}`);
    }

    return url;
  })(),

  // Environment
  env: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Vercel deployment info
  vercel: {
    url: optionalEnv('VERCEL_URL'),
    env: optionalEnv('VERCEL_ENV') as 'production' | 'preview' | 'development' | undefined,
    region: optionalEnv('VERCEL_REGION'),
    gitCommitSha: optionalEnv('VERCEL_GIT_COMMIT_SHA'),
  },
};

// Cron Job Configuration
export const cron = {
  secret: requireEnv('CRON_SECRET', 'Cron job authentication secret'),
};

// Security Configuration
export const security = {
  // Webhook verification enforcement
  enforceWebhookVerification: optionalEnv('ENFORCE_WEBHOOK_VERIFICATION', 'false') === 'true',

  // Session secrets
  jwtSecret: optionalEnv('JWT_SECRET'),
  nextAuthSecret: optionalEnv('NEXTAUTH_SECRET'),
};

// Monitoring & Alerting Configuration
export const monitoring = {
  // Slack webhook for alerts
  slackWebhook: optionalEnv('SLACK_WEBHOOK_URL'),

  // Email for critical alerts
  alertEmail: optionalEnv('ALERT_EMAIL'),

  // Sentry error tracking
  sentryDsn: optionalEnv('SENTRY_DSN'),
};

// Cost Tracking Configuration
export const costs = {
  // Monthly budget caps (in USD)
  monthlyBudget: {
    heygen: parseInt(optionalEnv('MONTHLY_BUDGET_HEYGEN', '330')), // $330/month
    submagic: parseInt(optionalEnv('MONTHLY_BUDGET_SUBMAGIC', '150')), // $150/month
    late: parseInt(optionalEnv('MONTHLY_BUDGET_LATE', '50')), // $50/month
    openai: parseInt(optionalEnv('MONTHLY_BUDGET_OPENAI', '15000')), // $15,000/month for high-volume usage
    total: parseInt(optionalEnv('MONTHLY_BUDGET_TOTAL', '15700')), // Updated total
  },

  // Daily budget caps (prevents runaway spending)
  dailyBudget: {
    heygen: parseInt(optionalEnv('DAILY_BUDGET_HEYGEN', '50')), // ~$15/day
    submagic: parseInt(optionalEnv('DAILY_BUDGET_SUBMAGIC', '50')), // ~$7/day
    openai: parseInt(optionalEnv('DAILY_BUDGET_OPENAI', '15000')), // $15,000/day for high-volume usage
  },

  // Cost per unit (for estimation)
  costPerUnit: {
    heygenCredit: 0.50, // $330 / 660 credits = $0.50 per credit
    submagicCredit: 0.25, // $150 / 600 videos = $0.25 per video (correct pricing)
    openaiGpt4oMiniInput: 0.15, // $0.15 per 1M input tokens
    openaiGpt4oMiniOutput: 0.60, // $0.60 per 1M output tokens
    latePost: 0, // Unlimited at $50/month
    r2StoragePerGB: 0.015, // $0.015 per GB/month
  },

  // Alert thresholds (percentage of budget)
  alertThresholds: {
    warning: 80, // Warn at 80% of budget
    critical: 95, // Critical alert at 95% of budget
  },
};

// Feature Flags
export const features = {
  // Enable/disable budget enforcement
  enforceBudgetCaps: optionalEnv('ENFORCE_BUDGET_CAPS', 'true') === 'true',

  // Enable/disable real-time alerting
  enableRealTimeAlerts: optionalEnv('ENABLE_REAL_TIME_ALERTS', 'true') === 'true',

  // Enable/disable A/B testing
  enableABTesting: optionalEnv('ENABLE_AB_TESTING', 'true') === 'true',

  // Enable/disable webhook signature verification
  enforceWebhookSigs: optionalEnv('ENFORCE_WEBHOOK_VERIFICATION', 'false') === 'true',
};

/**
 * Validate all required environment variables at startup
 * Call this in your app initialization to fail fast if config is missing
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Test all required variables by accessing them
    const testAccess = {
      apiKeys: apiKeys.heygen && apiKeys.submagic && apiKeys.late && apiKeys.openai,
      firebase: firebase.apiKey && firebase.projectId,
      cloudflare: cloudflare.r2.accountId && cloudflare.r2.bucketName,
      app: app.baseUrl,
      cron: cron.secret,
    };

    // Log warnings for missing optional but recommended variables
    if (!lateProfiles.carz) {
      console.warn('⚠️  LATE_CARZ_PROFILE_ID not set - Carz posting will fail');
    }
    if (!lateProfiles.ownerfi) {
      console.warn('⚠️  LATE_OWNERFI_PROFILE_ID not set - OwnerFi posting will fail');
    }
    if (!monitoring.slackWebhook) {
      console.warn('⚠️  SLACK_WEBHOOK_URL not set - No Slack alerts will be sent');
    }
    if (!apiKeys.heygenWebhookSecret) {
      console.warn('⚠️  HEYGEN_WEBHOOK_SECRET not set - Webhook verification disabled');
    }
    if (!security.enforceWebhookVerification) {
      console.warn('⚠️  ENFORCE_WEBHOOK_VERIFICATION=false - Security risk!');
    }

  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a summary of the current configuration (safe for logging)
 * Redacts sensitive values
 */
export function getConfigSummary(): Record<string, any> {
  return {
    environment: app.env,
    baseUrl: app.baseUrl,
    vercelEnv: app.vercel.env,

    // API keys (masked)
    apis: {
      heygen: apiKeys.heygen ? '***' + apiKeys.heygen.slice(-4) : 'NOT SET',
      submagic: apiKeys.submagic ? '***' + apiKeys.submagic.slice(-4) : 'NOT SET',
      late: apiKeys.late ? '***' + apiKeys.late.slice(-4) : 'NOT SET',
      openai: apiKeys.openai ? '***' + apiKeys.openai.slice(-4) : 'NOT SET',
    },

    // Late profiles configured
    lateProfiles: Object.entries(lateProfiles)
      .filter(([, id]) => id)
      .map(([brand]) => brand),

    // Budget configuration
    budgets: {
      monthly: costs.monthlyBudget,
      daily: costs.dailyBudget,
      enforcement: features.enforceBudgetCaps,
    },

    // Security settings
    security: {
      webhookVerification: security.enforceWebhookVerification,
      alertsEnabled: features.enableRealTimeAlerts,
    },

    // Features
    features: {
      abTesting: features.enableABTesting,
      budgetCaps: features.enforceBudgetCaps,
      realTimeAlerts: features.enableRealTimeAlerts,
    },
  };
}

// Export a default config object for convenience
export default {
  apiKeys,
  lateProfiles,
  firebase,
  cloudflare,
  app,
  cron,
  security,
  monitoring,
  costs,
  features,
  validateEnvironment,
  getConfigSummary,
};
