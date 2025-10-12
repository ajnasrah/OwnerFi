// Metricool API Integration
// Auto-post viral videos to social media platforms
// Supports multiple brands: Carz Inc and OwnerFi

import { fetchWithTimeout, retry, TIMEOUTS } from './api-utils';

const METRICOOL_BASE_URL = 'https://app.metricool.com/api/v2';

// Single Metricool account with multiple brands
const METRICOOL_API_KEY = process.env.METRICOOL_API_KEY;
const METRICOOL_USER_ID = process.env.METRICOOL_USER_ID;

// Brand IDs for Carz Inc and Prosway
const METRICOOL_CARZ_BRAND_ID = process.env.METRICOOL_CARZ_BRAND_ID;
const METRICOOL_OWNERFI_BRAND_ID = process.env.METRICOOL_OWNERFI_BRAND_ID;

export interface MetricoolPostRequest {
  videoUrl: string;
  caption: string;
  title?: string;
  hashtags?: string[];
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter')[];
  postTypes?: {
    instagram?: 'reels' | 'story';
    facebook?: 'reels' | 'story';
  };
  scheduleTime?: string; // ISO 8601 format, or omit for immediate posting
  brand: 'carz' | 'ownerfi'; // Required: which brand to post to
}

export interface MetricoolPostResponse {
  success: boolean;
  postId?: string;
  scheduledFor?: string;
  platforms?: string[];
  error?: string;
}

/**
 * Get brand-specific Metricool brand ID
 */
function getBrandId(brand: 'carz' | 'ownerfi'): string | null {
  if (brand === 'carz') {
    if (!METRICOOL_CARZ_BRAND_ID) {
      console.error('❌ Carz Inc brand ID not configured (METRICOOL_CARZ_BRAND_ID)');
      return null;
    }
    return METRICOOL_CARZ_BRAND_ID;
  } else {
    if (!METRICOOL_OWNERFI_BRAND_ID) {
      console.error('❌ OwnerFi brand ID not configured (METRICOOL_OWNERFI_BRAND_ID)');
      return null;
    }
    return METRICOOL_OWNERFI_BRAND_ID;
  }
}

/**
 * Post video to Metricool for publishing to social media
 */
export async function postToMetricool(request: MetricoolPostRequest): Promise<MetricoolPostResponse> {
  // Check API credentials
  if (!METRICOOL_API_KEY || !METRICOOL_USER_ID) {
    console.error('❌ Metricool API credentials not configured');
    return {
      success: false,
      error: 'Metricool API credentials not configured (METRICOOL_API_KEY, METRICOOL_USER_ID)'
    };
  }

  // Get brand ID
  const brandId = getBrandId(request.brand);
  if (!brandId) {
    return {
      success: false,
      error: `Brand ID not configured for ${request.brand === 'carz' ? 'Carz Inc' : 'OwnerFi'}`
    };
  }

  try {
    // Format caption with hashtags
    const fullCaption = formatCaption(request.caption, request.hashtags);

    const brandName = request.brand === 'carz' ? 'Carz Inc' : 'OwnerFi';
    console.log(`📤 Posting to Metricool (${brandName})...`);
    console.log('   Brand ID:', brandId);
    console.log('   Platforms:', request.platforms.join(', '));
    console.log('   Caption:', fullCaption.substring(0, 100) + '...');

    return await retry(
      async () => {
        // Format datetime for Metricool API (yyyy-MM-dd'T'HH:mm:ss)
        const publicationDate = request.scheduleTime
          ? new Date(request.scheduleTime).toISOString().replace(/\.\d{3}Z$/, '')
          : new Date().toISOString().replace(/\.\d{3}Z$/, '');

        // blogId and userId MUST be query parameters, not in the body
        const response = await fetchWithTimeout(
          `${METRICOOL_BASE_URL}/scheduler/posts?blogId=${brandId}&userId=${METRICOOL_USER_ID}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Mc-Auth': METRICOOL_API_KEY
            },
            body: JSON.stringify({
              text: fullCaption,
              publicationDate: {
                dateTime: publicationDate,
                timezone: 'America/New_York'
              },
              providers: request.platforms.map(platform => {
                const provider: any = { network: platform };

                // Set post type based on platform and request
                if (platform === 'instagram') {
                  provider.postType = request.postTypes?.instagram || 'reels';
                } else if (platform === 'facebook') {
                  provider.postType = request.postTypes?.facebook || 'reels';
                } else if (platform === 'youtube') {
                  provider.postType = 'shorts';
                }

                return provider;
              }),
              media: [request.videoUrl],
              // YouTube requires a title and category
              ...(request.platforms.includes('youtube') && {
                youtubeData: {
                  title: request.title || fullCaption.substring(0, 100),
                  privacy: 'PUBLIC',
                  madeForKids: false,
                  category: request.brand === 'carz' ? 'AUTOS_VEHICLES' : 'NEWS_POLITICS'
                }
              })
            })
          },
          TIMEOUTS.EXTERNAL_API
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Metricool API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        console.log(`✅ Posted to Metricool (${brandName}) successfully!`);
        console.log('   Post ID:', data.data?.id || data.id);
        console.log('   Status:', data.data?.providers?.[0]?.status);

        return {
          success: true,
          postId: data.data?.id?.toString() || data.id?.toString(),
          scheduledFor: data.data?.publicationDate?.dateTime || request.scheduleTime,
          platforms: request.platforms
        };
      },
      {
        maxAttempts: 3,
        backoff: 'exponential',
        onRetry: (attempt, error) => {
          console.log(`Metricool retry ${attempt}:`, error.message);
        }
      }
    );

  } catch (error) {
    console.error('❌ Error posting to Metricool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Format caption with hashtags
 */
function formatCaption(caption: string, hashtags?: string[]): string {
  if (!hashtags || hashtags.length === 0) {
    return caption;
  }

  // Ensure hashtags start with #
  const formattedHashtags = hashtags
    .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
    .join(' ');

  // Add hashtags on new lines
  return `${caption}\n\n${formattedHashtags}`;
}

/**
 * Extract hashtags from caption text
 */
export function extractHashtags(caption: string): string[] {
  const hashtagRegex = /#[\w]+/g;
  const matches = caption.match(hashtagRegex);
  return matches || [];
}

/**
 * Schedule video for optimal posting time
 */
export async function scheduleVideoPost(
  videoUrl: string,
  caption: string,
  title: string,
  platforms: MetricoolPostRequest['platforms'],
  delay: 'immediate' | '1hour' | '2hours' | '4hours' | 'optimal' = 'immediate',
  brand: 'carz' | 'ownerfi' = 'ownerfi'
): Promise<MetricoolPostResponse> {
  let scheduleTime: string | undefined;

  if (delay !== 'immediate') {
    const now = new Date();

    switch (delay) {
      case '1hour':
        now.setHours(now.getHours() + 1);
        break;
      case '2hours':
        now.setHours(now.getHours() + 2);
        break;
      case '4hours':
        now.setHours(now.getHours() + 4);
        break;
      case 'optimal':
        // Schedule for next optimal time (e.g., 7 PM)
        now.setHours(19, 0, 0, 0);
        if (now.getTime() < Date.now()) {
          now.setDate(now.getDate() + 1);
        }
        break;
    }

    scheduleTime = now.toISOString();
  }

  const hashtags = extractHashtags(caption);

  return postToMetricool({
    videoUrl,
    caption: caption.replace(/#[\w]+/g, '').trim(), // Remove hashtags from caption
    title,
    hashtags,
    platforms,
    scheduleTime,
    brand // Pass brand to postToMetricool
  });
}
