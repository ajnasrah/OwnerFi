/**
 * Google Business Profile Screenshot Service
 * 
 * Generates screenshots of Google Business profiles using Puppeteer
 * or fallback to static Google Maps embed
 */

interface ScreenshotOptions {
  width?: number;
  height?: number;
  quality?: number;
  timeout?: number;
}

/**
 * Generate Google Business profile URL for embedding
 */
export function getGoogleBusinessEmbedUrl(placeId: string, options: ScreenshotOptions = {}): string {
  const { width = 400, height = 300 } = options;
  
  // Use Google Maps embed API for business profile
  const baseUrl = 'https://www.google.com/maps/embed/v1/place';
  const params = new URLSearchParams({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    q: `place_id:${placeId}`,
    zoom: '15',
    maptype: 'roadmap',
    language: 'en'
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate static Google Business profile image URL
 * COST OPTIMIZATION: Only generate if needed, prefer regular photos
 */
export function getGoogleBusinessImageUrl(placeId: string, options: ScreenshotOptions = {}): string | null {
  // DISABLED FOR COST CONTROL - Street View Static API costs $7 per 1000 requests
  // This feature would add significant costs with no clear revenue benefit
  // Instead, we'll rely on Google Business Photos which are free
  
  console.log(`[COST-OPT] Skipping Street View image for place ${placeId} to control expenses`);
  return null;
  
  /* DISABLED CODE - Keep for future if budget allows
  const { width = 400, height = 300 } = options;
  
  const params = new URLSearchParams({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    size: `${width}x${height}`,
    location: `place_id:${placeId}`,
    heading: '0',
    pitch: '0',
    fov: '90'
  });
  
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
  */
}

/**
 * Enhanced agent data with screenshot/image URLs
 */
export interface AgentWithScreenshot {
  id: string;
  name: string;
  phone: string;
  website: string;
  address: string;
  rating: number;
  reviewCount: number;
  photo?: string;
  googleMapsUrl: string;
  specializations: string[];
  isFeatured: boolean;
  placeId: string;
  businessProfileImage?: string;
  businessEmbedUrl?: string;
}

/**
 * Enhance agent data with business profile visuals
 * COST-OPTIMIZED: Only include free/low-cost features
 */
export function enhanceAgentWithBusinessProfile(
  agent: any,
  options: ScreenshotOptions = {}
): AgentWithScreenshot {
  const placeId = agent.id?.replace('google_', '') || agent.place_id;
  
  return {
    ...agent,
    placeId,
    // businessProfileImage: null, // DISABLED for cost control
    businessProfileImage: getGoogleBusinessImageUrl(placeId, options), // Returns null anyway
    businessEmbedUrl: getGoogleBusinessEmbedUrl(placeId, options) // Free embedding
  };
}

/**
 * Server-side screenshot generation using Puppeteer (for future implementation)
 */
export async function generateBusinessProfileScreenshot(
  placeId: string,
  options: ScreenshotOptions = {}
): Promise<string | null> {
  // This would be implemented server-side with Puppeteer
  // For now, we'll use the static image approach
  
  try {
    // Future implementation:
    // 1. Launch Puppeteer browser
    // 2. Navigate to Google Business profile URL
    // 3. Wait for page load
    // 4. Take screenshot
    // 5. Upload to storage (Cloudinary, S3, etc.)
    // 6. Return image URL
    
    console.warn('Server-side screenshot generation not implemented yet');
    return getGoogleBusinessImageUrl(placeId, options);
  } catch (error) {
    console.error('Failed to generate business profile screenshot:', error);
    return null;
  }
}

/**
 * Google Business Profile Screenshot API endpoint (for future implementation)
 */
export interface ScreenshotRequest {
  placeId: string;
  width?: number;
  height?: number;
  quality?: number;
}

export interface ScreenshotResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}