/**
 * Brand Utility Functions
 *
 * Centralized utilities for brand validation, identification, and operations.
 * Ensures type-safe and consistent handling of brand-related logic.
 */

import { Brand } from '@/config/constants';
import {
  getBrandConfig,
  getBrandWebhooks,
  getBrandPlatforms,
  getBrandCollections,
  isBrand,
} from '@/config/brand-configs';

/**
 * Validate and normalize brand input
 * @param brand - Brand string to validate
 * @returns Validated Brand type
 * @throws Error if brand is invalid
 */
export function validateBrand(brand: unknown): Brand {
  if (typeof brand !== 'string') {
    throw new Error(`Invalid brand type: expected string, got ${typeof brand}`);
  }

  const normalizedBrand = brand.toLowerCase().trim();

  if (!isBrand(normalizedBrand)) {
    throw new Error(
      `Invalid brand: "${brand}". Must be one of: carz, ownerfi, podcast, benefit, property, vassdistro`
    );
  }

  return normalizedBrand;
}

/**
 * Safely parse brand from request params or body
 * @param value - Value to parse
 * @returns Brand if valid, null otherwise
 */
export function parseBrand(value: unknown): Brand | null {
  try {
    return validateBrand(value);
  } catch {
    return null;
  }
}

/**
 * Extract brand from workflow ID
 * Workflow IDs follow format: wf_<brand>_<timestamp>_<random> or podcast_<timestamp>_<random>
 * @param workflowId - Workflow identifier
 * @returns Brand if identifiable, null otherwise
 */
export function extractBrandFromWorkflowId(workflowId: string): Brand | null {
  // Check for podcast workflow
  if (workflowId.startsWith('podcast_')) {
    return 'podcast';
  }

  // Check for social media workflows with brand prefix
  if (workflowId.startsWith('wf_')) {
    const parts = workflowId.split('_');
    if (parts.length >= 2) {
      const possibleBrand = parts[1];
      if (isBrand(possibleBrand)) {
        return possibleBrand;
      }
    }
  }

  return null;
}

/**
 * Generate a brand-aware workflow ID
 * @param brand - Brand identifier
 * @param prefix - Optional prefix (default: 'wf')
 * @returns Unique workflow ID with brand embedded
 */
export function generateWorkflowId(brand: Brand, prefix: string = 'wf'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);

  if (brand === 'podcast') {
    return `podcast_${timestamp}_${random}`;
  }

  return `${prefix}_${brand}_${timestamp}_${random}`;
}

/**
 * Check if a platform is supported by a brand
 * @param brand - Brand identifier
 * @param platform - Platform to check
 * @returns True if platform is supported
 */
export function isBrandPlatformSupported(brand: Brand, platform: string): boolean {
  const allPlatforms = getBrandPlatforms(brand, true);
  return allPlatforms.includes(platform);
}

/**
 * Get collection name for a brand and type
 * @param brand - Brand identifier
 * @param type - Collection type ('feeds', 'articles', 'workflows')
 * @returns Collection name
 * @throws Error if collection type doesn't exist for brand
 */
export function getBrandCollection(
  brand: Brand,
  type: 'feeds' | 'articles' | 'workflows'
): string {
  const collections = getBrandCollections(brand);
  const collectionName = collections[type];

  if (!collectionName) {
    throw new Error(`Collection type "${type}" not available for brand "${brand}"`);
  }

  return collectionName;
}

/**
 * Get brand-specific R2 storage path
 * @param brand - Brand identifier
 * @param filename - File name
 * @returns R2 path with brand prefix
 */
export function getBrandStoragePath(brand: Brand, filename: string): string {
  return `${brand}/${filename}`;
}

/**
 * Parse storage path to extract brand
 * @param path - R2 storage path
 * @returns Brand if found, null otherwise
 */
export function extractBrandFromStoragePath(path: string): Brand | null {
  const parts = path.split('/');
  if (parts.length === 0) return null;

  const possibleBrand = parts[0];
  return isBrand(possibleBrand) ? possibleBrand : null;
}

/**
 * Get webhook URL for a brand and service
 * @param brand - Brand identifier
 * @param service - Service type ('heygen' | 'submagic')
 * @returns Webhook URL
 */
export function getBrandWebhookUrl(
  brand: Brand,
  service: 'heygen' | 'submagic'
): string {
  const webhooks = getBrandWebhooks(brand);
  return webhooks[service];
}

/**
 * Determine brand from request context
 * Checks: query params, body, headers
 * @param request - Next.js Request object
 * @returns Brand if found, null otherwise
 */
export function determineBrandFromRequest(request: Request): Brand | null {
  // Check URL path
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');

  // Look for brand in path segments
  for (const part of pathParts) {
    if (isBrand(part)) {
      return part;
    }
  }

  // Check query params
  const brandParam = url.searchParams.get('brand');
  if (brandParam && isBrand(brandParam)) {
    return brandParam;
  }

  return null;
}

/**
 * Build error context for logging
 * @param brand - Brand identifier
 * @param additionalContext - Additional context fields
 * @returns Error context object
 */
export function buildErrorContext(
  brand: Brand,
  additionalContext?: Record<string, unknown>
): Record<string, unknown> {
  return {
    brand,
    brandDisplayName: getBrandConfig(brand).displayName,
    timestamp: new Date().toISOString(),
    ...additionalContext,
  };
}

/**
 * Get YouTube category for brand
 * @param brand - Brand identifier
 * @returns YouTube category string
 */
export function getBrandYouTubeCategory(brand: Brand): string {
  return getBrandConfig(brand).content.youtubeCategory;
}

/**
 * Get default hashtags for brand
 * @param brand - Brand identifier
 * @returns Array of hashtags
 */
export function getBrandHashtags(brand: Brand): readonly string[] {
  return getBrandConfig(brand).content.defaultHashtags;
}

/**
 * Check if a feature is enabled for a brand
 * @param brand - Brand identifier
 * @param feature - Feature name
 * @returns True if feature is enabled
 */
export function isBrandFeatureEnabled(
  brand: Brand,
  feature: 'autoPosting' | 'abTesting' | 'analytics'
): boolean {
  return getBrandConfig(brand).features[feature];
}

/**
 * Get rate limit for a brand and service
 * @param brand - Brand identifier
 * @param service - Service type
 * @returns Rate limit (requests per hour)
 */
export function getBrandRateLimit(
  brand: Brand,
  service: 'lateAPI' | 'heygen' | 'submagic'
): number {
  return getBrandConfig(brand).rateLimits[service];
}

/**
 * Get scheduling configuration for brand
 * @param brand - Brand identifier
 * @returns Scheduling configuration object
 */
export function getBrandScheduling(brand: Brand) {
  return getBrandConfig(brand).scheduling;
}

/**
 * Check if current time is within brand posting hours
 * @param brand - Brand identifier
 * @param date - Date to check (default: now)
 * @returns True if within posting hours
 */
export function isWithinPostingHours(brand: Brand, date: Date = new Date()): boolean {
  const { postingHours, timezone } = getBrandScheduling(brand);

  // Convert date to brand's timezone
  const hour = new Date(
    date.toLocaleString('en-US', { timeZone: timezone })
  ).getHours();

  return postingHours.includes(hour);
}

/**
 * Format brand name for display
 * @param brand - Brand identifier
 * @returns Formatted brand display name
 */
export function formatBrandName(brand: Brand): string {
  return getBrandConfig(brand).displayName;
}

/**
 * Validate multiple brands at once
 * @param brands - Array of brand values to validate
 * @returns Array of validated brands
 * @throws Error if any brand is invalid
 */
export function validateBrands(brands: unknown[]): Brand[] {
  return brands.map(validateBrand);
}

/**
 * Get all valid brand identifiers
 * @returns Array of valid brand IDs
 */
export function getAllBrandIds(): Brand[] {
  return ['carz', 'ownerfi', 'podcast'];
}

/**
 * Create a brand-specific error message
 * @param brand - Brand identifier
 * @param message - Error message
 * @returns Formatted error message with brand context
 */
export function createBrandError(brand: Brand, message: string): Error {
  const displayName = formatBrandName(brand);
  return new Error(`[${displayName}] ${message}`);
}

/**
 * Sanitize brand input from user
 * Handles common variations and typos
 * @param input - User input
 * @returns Sanitized brand or null if invalid
 */
export function sanitizeBrandInput(input: string): Brand | null {
  const normalized = input.toLowerCase().trim();

  // Handle variations
  const variations: Record<string, Brand> = {
    'carz': 'carz',
    'cars': 'carz',
    'car': 'carz',
    'carzinc': 'carz',
    'ownerfi': 'ownerfi',
    'owner': 'ownerfi',
    'podcast': 'podcast',
    'podcasts': 'podcast',
  };

  return variations[normalized] || null;
}
