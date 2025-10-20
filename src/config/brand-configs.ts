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
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://ownerfi.ai'; // fallback
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
    timezone: 'America/New_York',
    postingHours: [9, 11, 14, 18, 20],
    maxPostsPerDay: 15,
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
    postingHours: [9, 11, 14, 18, 20],
    maxPostsPerDay: 15,
  },

  features: {
    autoPosting: true,
    abTesting: true,
    analytics: true,
  },
};

/**
 * Podcast Brand Configuration
 */
export const PODCAST_CONFIG: BrandConfig = {
  id: 'podcast',
  displayName: 'Podcast',

  lateProfileId: process.env.LATE_PODCAST_PROFILE_ID || '',

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/podcast`,
    submagic: `${BASE_URL}/api/webhooks/submagic/podcast`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#podcast', '#education', '#interview', '#learning', '#knowledge'],
    captionStyle: 'educational',
  },

  collections: {
    workflows: 'podcast_workflow_queue',
  },

  rateLimits: {
    lateAPI: 50,  // 50 posts per hour (lower for podcast)
    heygen: 20,   // 20 video generations per hour
    submagic: 240, // 4 per minute = 240 per hour
  },

  scheduling: {
    timezone: 'America/Chicago', // Podcast uses Central Time
    postingHours: [9, 12, 15, 18, 21],
    maxPostsPerDay: 3, // 3 episodes per day
  },

  features: {
    autoPosting: true,
    abTesting: false, // Podcast doesn't use A/B testing
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
    timezone: 'America/Chicago', // Central Time
    postingHours: [9, 12, 15, 18, 21],
    maxPostsPerDay: 2, // 2 benefit videos per day (1 seller, 1 buyer)
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
  podcast: PODCAST_CONFIG,
  benefit: BENEFIT_CONFIG,
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
    throw new Error(`Invalid brand: ${brand}. Must be one of: carz, ownerfi, podcast, benefit`);
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
    podcast: validateBrandConfig('podcast'),
    benefit: validateBrandConfig('benefit'),
  };
}
