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
    timezone: 'America/New_York',
    postingHours: [9, 12, 15, 18, 21],
    maxPostsPerDay: 5,
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
    postingHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], // 15 slots/day
    maxPostsPerDay: 15, // 5 viral + 5 benefits + 5 properties (flexible)
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
    excludeFromDefault: [], // All platforms enabled
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
    maxPostsPerDay: 5, // 5 episodes per day
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
    postingHours: [9, 12, 15, 18, 21], // Offset by 20 min from viral
    maxPostsPerDay: 5, // 5 benefit videos per day
  },

  features: {
    autoPosting: true,
    abTesting: false,
    analytics: true,
  },
};

/**
 * Property Videos Brand Configuration
 * For automated property showcase videos (15-sec format)
 */
export const PROPERTY_CONFIG: BrandConfig = {
  id: 'property',
  displayName: 'Property Showcase',

  lateProfileId: process.env.LATE_OWNERFI_PROFILE_ID || '', // Uses OwnerFi's Late profile

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky', 'pinterest', 'reddit'],
    excludeFromDefault: [], // All platforms enabled
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/property`,
    submagic: `${BASE_URL}/api/webhooks/submagic/property`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#OwnerFinancing', '#RealEstate', '#PropertyForSale', '#HomeForSale', '#OwnerFi'],
    captionStyle: 'professional',
  },

  collections: {
    workflows: 'propertyShowcaseWorkflows', // NEW unified system
  },

  rateLimits: {
    lateAPI: 50,  // 50 posts per hour
    heygen: 20,   // 20 video generations per hour
    submagic: 240, // 4 per minute = 240 per hour
  },

  scheduling: {
    timezone: 'America/New_York', // Eastern Time
    postingHours: [9, 12, 15, 18, 21], // Offset by 40 min from viral
    maxPostsPerDay: 5, // 1 per cron run × 5 runs = 5 per day
  },

  features: {
    autoPosting: true,
    abTesting: false, // No A/B testing - just 15-sec
    analytics: true,
  },
};

/**
 * Property Videos Brand Configuration (Spanish)
 * For automated property showcase videos in Spanish (15-sec format)
 * Uses same property queue as English version
 */
export const PROPERTY_SPANISH_CONFIG: BrandConfig = {
  id: 'property-spanish',
  displayName: 'Property Showcase (Spanish)',

  lateProfileId: process.env.LATE_OWNERFI_PROFILE_ID || '', // Uses OwnerFi's Late profile

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky', 'pinterest', 'reddit'],
    excludeFromDefault: [], // All platforms enabled
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/property-spanish`,
    submagic: `${BASE_URL}/api/webhooks/submagic/property-spanish`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#FinanciamientoPorElDueño', '#BienesRaices', '#PropiedadEnVenta', '#CasaEnVenta', '#OwnerFi'],
    captionStyle: 'professional',
  },

  collections: {
    workflows: 'propertyShowcaseWorkflows', // NEW unified system (shared with English)
  },

  rateLimits: {
    lateAPI: 50,  // 50 posts per hour
    heygen: 20,   // 20 video generations per hour
    submagic: 240, // 4 per minute = 240 per hour
  },

  scheduling: {
    timezone: 'America/New_York', // Eastern Time
    postingHours: [10, 13, 16, 19, 22], // Offset by 1 hour from English version
    maxPostsPerDay: 5, // 1 per cron run × 5 runs = 5 per day
  },

  features: {
    autoPosting: true,
    abTesting: false, // No A/B testing - just 15-sec
    analytics: true,
  },
};

/**
 * Vass Distro Brand Configuration
 * For B2B vape wholesale industry content targeting vape store owners
 */
export const VASSDISTRO_CONFIG: BrandConfig = {
  id: 'vassdistro',
  displayName: 'Vass Distro',

  lateProfileId: process.env.LATE_VASSDISTRO_PROFILE_ID || '',

  platforms: {
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
    all: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
    excludeFromDefault: [], // All platforms enabled
  },

  webhooks: {
    heygen: `${BASE_URL}/api/webhooks/heygen/vassdistro`,
    submagic: `${BASE_URL}/api/webhooks/submagic/vassdistro`,
  },

  content: {
    youtubeCategory: 'NEWS_POLITICS',
    defaultHashtags: ['#vape', '#vapewholesale', '#vapestore', '#vapebusiness', '#vassdistro'],
    captionStyle: 'professional',
  },

  collections: {
    feeds: 'vassdistro_rss_feeds',
    articles: 'vassdistro_articles',
    workflows: 'vassdistro_workflow_queue',
  },

  rateLimits: {
    lateAPI: 50,  // 50 posts per hour
    heygen: 20,   // 20 video generations per hour
    submagic: 240, // 4 per minute = 240 per hour
  },

  scheduling: {
    timezone: 'America/New_York',
    postingHours: [8, 11, 14, 17, 20], // 5 posts per day - B2B optimized times
    maxPostsPerDay: 5,
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
    default: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'],
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
    postingHours: [9, 12, 15, 18, 21], // 5 posts per day staggered throughout day
    maxPostsPerDay: 5, // 5 daily videos
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
    postingHours: [11, 14, 19, 20] as const, // 11am, 2pm, 7pm, 8pm CST (optimal times)
    maxPostsPerDay: 10,
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
  property: PROPERTY_CONFIG,
  'property-spanish': PROPERTY_SPANISH_CONFIG,
  vassdistro: VASSDISTRO_CONFIG,
  abdullah: ABDULLAH_CONFIG,
  personal: PERSONAL_CONFIG,
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
    throw new Error(`Invalid brand: ${brand}. Must be one of: carz, ownerfi, podcast, benefit, property, property-spanish, vassdistro, abdullah, personal`);
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
    property: validateBrandConfig('property'),
    'property-spanish': validateBrandConfig('property-spanish'),
    vassdistro: validateBrandConfig('vassdistro'),
    abdullah: validateBrandConfig('abdullah'),
    personal: validateBrandConfig('personal'),
  };
}
