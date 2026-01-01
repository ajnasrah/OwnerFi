/**
 * Centralized Brand Configuration
 *
 * This file contains all brand-specific settings for Carz Inc, OwnerFi, and Podcast.
 * Each brand has its own isolated configuration to ensure failures in one brand
 * don't affect the others.
 */

import { Brand } from './constants';

// Brand-specific configuration type
export interface BrandConfig {
  // Brand identifier
  id: Brand;
  displayName: string;

  // Late API Configuration
  lateProfileId: string;

  // Social Media Platforms
  platforms: {
    default: readonly string[];
    all: readonly string[];
    excludeFromDefault?: readonly string[];
  };

  // Webhook URLs (brand-specific isolation)
  webhooks: {
    heygen: string;
    submagic: string;
  };

  // Content Configuration
  content: {
    youtubeCategory: string;
    defaultHashtags: readonly string[];
    captionStyle?: 'professional' | 'casual' | 'educational';
  };

  // Firestore Collections
  collections: {
    feeds?: string;
    articles?: string;
    workflows: string;
  };

  // Rate Limits (per brand)
  rateLimits: {
    lateAPI: number; // requests per hour
    heygen: number;  // requests per hour
    submagic: number; // requests per hour
  };

  // Scheduling Configuration
  scheduling: {
    timezone: string;
    postingHours: readonly number[];
    maxPostsPerDay: number;
  };

  // Feature Flags
  features: {
    autoPosting: boolean;
    abTesting: boolean;
    analytics: boolean;
  };
}

// Get base URL from environment
const getBaseUrl = (): string => {
  let url = process.env.NEXT_PUBLIC_BASE_URL;

  // Use Vercel URL if NEXT_PUBLIC_BASE_URL not set
  if (!url && process.env.VERCEL_URL) {
    url = `https://${process.env.VERCEL_URL}`;
  }

  // Fallback to production domain
  if (!url) {
    url = 'https://ownerfi.ai';
  }

  // Warn about non-HTTPS in production (don't throw to avoid build errors)
  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    console.warn(`⚠️  BASE_URL should use HTTPS in production: ${url}`);
  }

  return url;
};

const BASE_URL = getBaseUrl();

/**
 * Carz Inc Brand Configuration
 */
export const CARZ_CONFIG: BrandConfig = {
  id: 'carz',
  displayName: 'Carz Inc',

  lateProfileId: process.env.LATE_CARZ_PROFILE_ID || '',

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'pinterest'],
    excludeFromDefault: ['twitter', 'bluesky'], // Carz doesn't use Twitter/Bluesky
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/carz`,
    submagic: `${BASE_URL}/api/webhooks/submagic/carz`,
  },

  content: {
    youtubeCategory: 'AUTOS_VEHICLES',
    defaultHashtags: ['#cars', '#automotive', '#vehicles', '#auto', '#carlovers'],
    captionStyle: 'professional',
  },

  collections: {
    feeds: 'carz_rss_feeds',
    articles: 'carz_articles',
    workflows: 'carz_workflow_queue',
  },

  rateLimits: {
    lateAPI: 100, // 100 posts per hour
    heygen: 50,   // 50 video generations per hour
    submagic: 480, // 8 per minute = 480 per hour
  },

  scheduling: {
    timezone: 'America/Chicago', // Memphis, TN is in Central Time
    postingHours: [8, 12, 19],
    maxPostsPerDay: 3,
  },

  features: {
    autoPosting: true,
    abTesting: true,
    analytics: true,
  },
};

/**
 * OwnerFi Brand Configuration
 */
export const OWNERFI_CONFIG: BrandConfig = {
  id: 'ownerfi',
  displayName: 'OwnerFi',

  lateProfileId: process.env.LATE_OWNERFI_PROFILE_ID || '',

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky', 'pinterest', 'reddit'],
    excludeFromDefault: [], // All platforms enabled
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/ownerfi`,
    submagic: `${BASE_URL}/api/webhooks/submagic/ownerfi`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#realestate', '#ownerfinancing', '#property', '#investment', '#homeownership'],
    captionStyle: 'professional',
  },

  collections: {
    feeds: 'ownerfi_rss_feeds',
    articles: 'ownerfi_articles',
    workflows: 'ownerfi_workflow_queue',
  },

  rateLimits: {
    lateAPI: 100, // 100 posts per hour
    heygen: 50,   // 50 video generations per hour
    submagic: 480, // 8 per minute = 480 per hour
  },

  scheduling: {
    timezone: 'America/New_York',
    postingHours: [8, 12, 19],
    maxPostsPerDay: 3,
  },

  features: {
    autoPosting: true,
    abTesting: true,
    analytics: true,
  },
};


/**
 * Benefit Videos Brand Configuration
 * For Owner Finance informational videos (seller + buyer benefits)
 */
export const BENEFIT_CONFIG: BrandConfig = {
  id: 'benefit',
  displayName: 'Owner Finance Benefits',

  lateProfileId: process.env.LATE_OWNERFI_PROFILE_ID || '', // Uses OwnerFi's Late profile

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky', 'pinterest', 'reddit'],
    excludeFromDefault: [], // All platforms enabled
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/benefit`,
    submagic: `${BASE_URL}/api/webhooks/submagic/benefit`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#OwnerFinancing', '#RealEstate', '#Homeownership', '#Investment', '#OwnerFi'],
    captionStyle: 'educational',
  },

  collections: {
    workflows: 'benefit_workflow_queue',
  },

  rateLimits: {
    lateAPI: 50,  // 50 posts per hour
    heygen: 20,   // 20 video generations per hour
    submagic: 240, // 4 per minute = 240 per hour
  },

  scheduling: {
    timezone: 'America/Chicago', // Central Time (CDT)
    postingHours: [8, 12, 19],
    maxPostsPerDay: 3,
  },

  features: {
    autoPosting: true,
    abTesting: false,
    analytics: true,
  },
};


/**
 * Abdullah Personal Brand Configuration
 * For personal brand content - daily mindset, business, and life content
 */
export const ABDULLAH_CONFIG: BrandConfig = {
  id: 'abdullah',
  displayName: 'Abdullah Personal Brand',

  lateProfileId: process.env.LATE_ABDULLAH_PROFILE_ID || '', // Create new Late profile for Abdullah

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
    excludeFromDefault: [], // All platforms enabled
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/abdullah`,
    submagic: `${BASE_URL}/api/webhooks/submagic/abdullah`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#Abdullah', '#Mindset', '#Business', '#Entrepreneur', '#Growth'],
    captionStyle: 'casual',
  },

  collections: {
    workflows: 'abdullah_workflow_queue',
  },

  rateLimits: {
    lateAPI: 50,  // 50 posts per hour
    heygen: 30,   // 30 video generations per hour (5 daily videos)
    submagic: 240, // 4 per minute = 240 per hour
  },

  scheduling: {
    timezone: 'America/Chicago', // Central Time (CDT)
    postingHours: [8, 12, 19],
    maxPostsPerDay: 3,
  },

  features: {
    autoPosting: true,
    abTesting: false, // No A/B testing for personal brand
    analytics: true,
  },
};

/**
 * Personal Brand Configuration (Google Drive uploads)
 */
export const PERSONAL_CONFIG: BrandConfig = {
  id: 'personal',
  displayName: 'Personal Videos',

  lateProfileId: process.env.LATE_PERSONAL_PROFILE_ID || '',

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'twitter', 'threads'] as const,
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'twitter', 'threads', 'pinterest'] as const,
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/personal`, // Not used (no HeyGen for personal videos)
    submagic: `${BASE_URL}/api/webhooks/submagic/personal`,
  },

  content: {
    youtubeCategory: '22', // People & Blogs
    defaultHashtags: ['#PersonalBrand', '#ContentCreator', '#Entrepreneur', '#DailyVlog'] as const,
    captionStyle: 'casual',
  },

  collections: {
    workflows: 'personal_workflow_queue',
  },

  rateLimits: {
    lateAPI: 30,
    heygen: 0, // Not used
    submagic: 20,
  },

  scheduling: {
    timezone: 'America/Chicago', // CST
    postingHours: [8, 12, 19] as const,
    maxPostsPerDay: 3,
  },

  features: {
    autoPosting: true,
    abTesting: false,
    analytics: true,
  },
};

/**
 * Gaza Relief News Brand Configuration
 * For pro-Gaza humanitarian news content with donation CTAs
 */
export const GAZA_CONFIG: BrandConfig = {
  id: 'gaza',
  displayName: 'Gaza Relief News',

  lateProfileId: process.env.LATE_GAZA_PROFILE_ID || '',

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
    excludeFromDefault: [],
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/gaza`,
    submagic: `${BASE_URL}/api/webhooks/submagic/gaza`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#Gaza', '#Palestine', '#HumanitarianCrisis', '#FreePalestine', '#GazaRelief'],
    captionStyle: 'professional', // Serious professional tone for humanitarian news
  },

  collections: {
    feeds: 'gaza_rss_feeds',
    articles: 'gaza_articles',
    workflows: 'gaza_workflow_queue',
  },

  rateLimits: {
    lateAPI: 50,
    heygen: 20,
    submagic: 240,
  },

  scheduling: {
    timezone: 'America/Chicago',
    postingHours: [8, 12, 19],
    maxPostsPerDay: 3,
  },

  features: {
    autoPosting: true,
    abTesting: false,
    analytics: true,
  },
};

/**
 * Brand Configuration Map
 * Easy lookup of brand configs by brand ID
 */
export const BRAND_CONFIGS: Record<Brand, BrandConfig> = {
  carz: CARZ_CONFIG,
  ownerfi: OWNERFI_CONFIG,
  benefit: BENEFIT_CONFIG,
  abdullah: ABDULLAH_CONFIG,
  personal: PERSONAL_CONFIG,
  gaza: GAZA_CONFIG,
} as const;

/**
 * Get brand configuration by brand ID
 * @param brand - Brand identifier
 * @returns Brand configuration object
 * @throws Error if brand is invalid
 */
export function getBrandConfig(brand: Brand): BrandConfig {
  const config = BRAND_CONFIGS[brand];
  if (!config) {
    throw new Error(`Invalid brand: ${brand}. Must be one of: carz, ownerfi, benefit, abdullah, personal, gaza`);
  }
  return config;
}

/**
 * Get all brand configurations
 * @returns Array of all brand configs
 */
export function getAllBrandConfigs(): BrandConfig[] {
  return Object.values(BRAND_CONFIGS);
}

/**
 * Check if a brand exists
 * @param brand - Brand identifier to check
 * @returns True if brand exists
 */
export function isBrand(brand: string): brand is Brand {
  return brand in BRAND_CONFIGS;
}

/**
 * Get webhook URLs for a brand
 * @param brand - Brand identifier
 * @returns Webhook URLs object
 */
export function getBrandWebhooks(brand: Brand) {
  return getBrandConfig(brand).webhooks;
}

/**
 * Get platforms for a brand
 * @param brand - Brand identifier
 * @param includeAll - Whether to return all platforms or just default
 * @returns Array of platform identifiers
 */
export function getBrandPlatforms(brand: Brand, includeAll: boolean = false): readonly string[] {
  const config = getBrandConfig(brand);
  return includeAll ? config.platforms.all : config.platforms.default;
}

/**
 * Get collection names for a brand
 * @param brand - Brand identifier
 * @returns Collection names object
 */
export function getBrandCollections(brand: Brand) {
  return getBrandConfig(brand).collections;
}

/**
 * Validate brand configuration at runtime
 * @param brand - Brand identifier
 * @returns Validation result with errors if any
 */
export function validateBrandConfig(brand: Brand): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getBrandConfig(brand);

  // Check required fields
  if (!config.lateProfileId) {
    errors.push(`Missing Late API profile ID for ${brand}`);
  }

  if (!config.webhooks.heygen) {
    errors.push(`Missing HeyGen webhook URL for ${brand}`);
  }

  if (!config.webhooks.submagic) {
    errors.push(`Missing Submagic webhook URL for ${brand}`);
  }

  if (config.platforms.default.length === 0) {
    errors.push(`No default platforms configured for ${brand}`);
  }

  if (!config.collections.workflows) {
    errors.push(`Missing workflow collection for ${brand}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate all brand configurations
 * @returns Map of brand to validation results
 */
export function validateAllBrandConfigs(): Record<Brand, { valid: boolean; errors: string[] }> {
  return {
    carz: validateBrandConfig('carz'),
    ownerfi: validateBrandConfig('ownerfi'),
    benefit: validateBrandConfig('benefit'),
    abdullah: validateBrandConfig('abdullah'),
    personal: validateBrandConfig('personal'),
    gaza: validateBrandConfig('gaza'),
  };
}
