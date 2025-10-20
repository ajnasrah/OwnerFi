/**
 * Property Auto-Cleanup Utilities
 *
 * Automatically cleans property data when properties are created or updated:
 * - Removes city, state, zip from address field if duplicated
 * - Upgrades low-resolution images to high-resolution versions
 */

/**
 * Clean address by removing city, state, zip if present
 */
export function cleanAddress(address: string, city?: string, state?: string, zipCode?: string): string {
  if (!address || !city) {
    return address;
  }

  let cleaned = address.trim();

  // Build patterns to remove
  const patterns: RegExp[] = [];

  // Pattern 1: ", City, State Zip" (most common)
  if (city && state && zipCode) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s*,\\s*${escapeRegex(state)}\\s+${escapeRegex(zipCode)}\\s*$`, 'i'));
  }

  // Pattern 2: ", City, State"
  if (city && state) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s*,\\s*${escapeRegex(state)}\\s*$`, 'i'));
  }

  // Pattern 3: ", City Zip"
  if (city && zipCode) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s+${escapeRegex(zipCode)}\\s*$`, 'i'));
  }

  // Pattern 4: ", City"
  if (city) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s*$`, 'i'));
  }

  // Apply patterns
  for (const pattern of patterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '').trim();
      break; // Only apply the first matching pattern
    }
  }

  return cleaned;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Upgrade Zillow image URL to highest resolution
 *
 * Zillow image sizes:
 * - p_c.jpg = compressed thumbnail (worst)
 * - cc_ft_384.webp = 384px
 * - cc_ft_576.webp = 576px
 * - cc_ft_768.webp = 768px
 * - cc_ft_960.webp = 960px
 * - cc_ft_1152.webp = 1152px
 * - cc_ft_1344.webp = 1344px
 * - cc_ft_1536.webp = 1536px (best)
 * - uncropped_scaled_within_1536_1152.webp = full size
 */
export function upgradeZillowImageUrl(url: string): string {
  if (!url || !url.includes('zillowstatic.com')) {
    return url;
  }

  // Replace low-res with high-res
  let upgraded = url;

  // Replace all small sizes with full-size uncropped version
  const sizes = [
    'p_c.jpg', 'p_e.jpg', 'p_f.jpg', 'p_g.jpg', 'p_h.jpg',
    'cc_ft_192.webp', 'cc_ft_384.webp', 'cc_ft_576.webp',
    'cc_ft_768.webp', 'cc_ft_960.webp', 'cc_ft_1152.webp',
    'cc_ft_1344.webp'
  ];

  for (const size of sizes) {
    if (upgraded.includes(size)) {
      // Try uncropped full size first
      upgraded = upgraded.replace(size, 'uncropped_scaled_within_1536_1152.webp');
      return upgraded;
    }
  }

  // Already high-res or unknown format
  return url;
}

/**
 * Fix Google Drive image URL to direct high-res link
 */
export function fixGoogleDriveUrl(url: string): string {
  if (!url || !url.includes('drive.google.com')) {
    return url;
  }

  // Extract file ID from various Google Drive URL formats
  let fileId: string | null = null;

  // Format 1: https://drive.google.com/file/d/FILE_ID/view
  const match1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    fileId = match1[1];
  }

  // Format 2: https://drive.google.com/open?id=FILE_ID
  const match2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (match2) {
    fileId = match2[1];
  }

  // Format 3: Already a direct link
  if (url.includes('googleusercontent.com')) {
    return url;
  }

  if (fileId) {
    // Use high-resolution direct link (w=2000 for 2000px width)
    return `https://lh3.googleusercontent.com/d/${fileId}=w2000`;
  }

  return url;
}

/**
 * Upgrade image URL to highest quality version
 * Handles Zillow, Google Drive, and other sources
 */
export function upgradeImageUrl(url: string): string {
  if (!url) return url;

  // Handle different image sources
  if (url.includes('zillowstatic.com')) {
    return upgradeZillowImageUrl(url);
  } else if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
    return fixGoogleDriveUrl(url);
  }

  // Return unchanged for other sources
  return url;
}

/**
 * Auto-cleanup property data
 * Cleans address and upgrades all image URLs
 */
export function autoCleanPropertyData(propertyData: {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  imageUrl?: string;
  imageUrls?: string[];
  zillowImageUrl?: string;
}): {
  address?: string;
  imageUrl?: string;
  imageUrls?: string[];
  zillowImageUrl?: string;
} {
  const cleaned: {
    address?: string;
    imageUrl?: string;
    imageUrls?: string[];
    zillowImageUrl?: string;
  } = {};

  // Clean address
  if (propertyData.address) {
    cleaned.address = cleanAddress(
      propertyData.address,
      propertyData.city,
      propertyData.state,
      propertyData.zipCode
    );
  }

  // Upgrade imageUrl
  if (propertyData.imageUrl) {
    cleaned.imageUrl = upgradeImageUrl(propertyData.imageUrl);
  }

  // Upgrade imageUrls array
  if (propertyData.imageUrls && Array.isArray(propertyData.imageUrls)) {
    cleaned.imageUrls = propertyData.imageUrls.map(url => upgradeImageUrl(url));
  }

  // Upgrade zillowImageUrl
  if (propertyData.zillowImageUrl) {
    cleaned.zillowImageUrl = upgradeImageUrl(propertyData.zillowImageUrl);
  }

  return cleaned;
}
