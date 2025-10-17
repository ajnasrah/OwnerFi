// Late API Integration
// Complete replacement for Metricool - handles all social media posting
// Supports Instagram, TikTok, YouTube, Facebook, LinkedIn, Twitter, Threads, Pinterest, Reddit, Bluesky

import { fetchWithTimeout, retry, TIMEOUTS, circuitBreakers, RateLimitError } from './api-utils';
import { ERROR_MESSAGES } from '@/config/constants';

const LATE_BASE_URL = 'https://getlate.dev/api/v1';

// Late API credentials
const LATE_API_KEY = process.env.LATE_API_KEY;

// Profile IDs for each brand
const LATE_OWNERFI_PROFILE_ID = process.env.LATE_OWNERFI_PROFILE_ID;
const LATE_CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;
const LATE_PODCAST_PROFILE_ID = process.env.LATE_PODCAST_PROFILE_ID;

export interface LatePostRequest {
  videoUrl: string;
  caption: string;
  title?: string;
  hashtags?: string[];
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter' | 'pinterest' | 'reddit' | 'bluesky')[];
  scheduleTime?: string; // ISO 8601 format, or omit for immediate posting
  brand: 'carz' | 'ownerfi' | 'podcast';
  postTypes?: {
    instagram?: 'reel' | 'story';
    facebook?: 'feed' | 'story';
  };
}

export interface LatePostResponse {
  success: boolean;
  postId?: string;
  scheduledFor?: string;
  platforms?: string[];
  error?: string;
}

export interface LateProfile {
  id: string;
  name: string;
  accounts: {
    platform: string;
    accountId: string;
    username?: string;
  }[];
}

/**
 * Get profile ID for a brand
 */
function getProfileId(brand: 'carz' | 'ownerfi' | 'podcast'): string | null {
  switch (brand) {
    case 'ownerfi':
      return LATE_OWNERFI_PROFILE_ID || null;
    case 'carz':
      return LATE_CARZ_PROFILE_ID || null;
    case 'podcast':
      return LATE_PODCAST_PROFILE_ID || null;
  }
}

/**
 * Get all profiles from Late
 */
export async function getLateProfiles(): Promise<LateProfile[]> {
  if (!LATE_API_KEY) {
    throw new Error('Late API key not configured (LATE_API_KEY)');
  }

  try {
    console.log('📡 Fetching Late profiles...');

    const response = await fetchWithTimeout(
      `${LATE_BASE_URL}/profiles`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      },
      TIMEOUTS.EXTERNAL_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Late API error: ${response.status} - ${errorText}`);
    }

    const profiles = await response.json();

    console.log('✅ Late profiles fetched:');
    profiles.forEach((profile: LateProfile) => {
      console.log(`   - ${profile.name} (ID: ${profile.id})`);
      profile.accounts?.forEach(account => {
        console.log(`     • ${account.platform}: ${account.username || account.accountId}`);
      });
    });

    return profiles;

  } catch (error) {
    console.error('❌ Error fetching Late profiles:', error);
    throw error;
  }
}

/**
 * Get accounts for a specific profile
 */
export async function getLateAccounts(profileId: string): Promise<any[]> {
  if (!LATE_API_KEY) {
    throw new Error('Late API key not configured (LATE_API_KEY)');
  }

  try {
    const response = await fetchWithTimeout(
      `${LATE_BASE_URL}/accounts?profileId=${profileId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      },
      TIMEOUTS.EXTERNAL_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Late API error: ${response.status} - ${errorText}`);
    }

    let accountsData = await response.json();

    // Handle different response formats - Late API may return array or object with accounts wrapper
    const accounts = Array.isArray(accountsData) ? accountsData :
                     accountsData.accounts ? accountsData.accounts :
                     accountsData.data ? accountsData.data : [];

    return accounts;

  } catch (error) {
    console.error('❌ Error fetching Late accounts:', error);
    throw error;
  }
}

/**
 * Post content to Late for publishing to social media
 */
export async function postToLate(request: LatePostRequest): Promise<LatePostResponse> {
  // Check API credentials
  if (!LATE_API_KEY) {
    console.error('❌ Late API key not configured');
    return {
      success: false,
      error: 'Late API key not configured (LATE_API_KEY)'
    };
  }

  // Get profile ID for brand
  const profileId = getProfileId(request.brand);
  if (!profileId) {
    const brandName = request.brand === 'carz' ? 'Carz' : request.brand === 'ownerfi' ? 'OwnerFi' : 'Podcast';
    console.error(`❌ Profile ID not configured for ${brandName}`);
    return {
      success: false,
      error: `Profile ID not configured for ${brandName}. Set LATE_${request.brand.toUpperCase()}_PROFILE_ID in .env`
    };
  }

  try {
    // First, get the accounts for this profile to get accountIds
    const accounts = await getLateAccounts(profileId);

    // Map platform names to account IDs
    const platformAccounts = request.platforms
      .map(platform => {
        const account = accounts.find(acc => acc.platform.toLowerCase() === platform.toLowerCase());
        if (!account) {
          console.warn(`⚠️  No ${platform} account found for profile ${profileId}`);
          return null;
        }
        return {
          platform: platform,
          accountId: account._id // Late API uses MongoDB-style _id field
        };
      })
      .filter(Boolean) as { platform: string; accountId: string }[];

    if (platformAccounts.length === 0) {
      return {
        success: false,
        error: 'No connected accounts found for requested platforms'
      };
    }

    // Build caption with hashtags
    let fullCaption = request.caption;
    if (request.hashtags && request.hashtags.length > 0) {
      const formattedHashtags = request.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      fullCaption = `${request.caption}\n\n${formattedHashtags}`;
    }

    const brandName = request.brand === 'carz' ? 'Carz' : request.brand === 'ownerfi' ? 'OwnerFi' : 'Podcast';
    console.log(`📤 Posting to Late (${brandName})...`);
    console.log('   Profile ID:', profileId);
    console.log('   Platforms:', platformAccounts.map(p => p.platform).join(', '));
    console.log('   Caption:', fullCaption.substring(0, 100) + '...');

    return await retry(
      async () => {
        // Use circuit breaker to prevent cascading failures
        return await circuitBreakers.late.execute(async () => {
          // Build platforms with story support
          const platforms = platformAccounts.map(p => {
            const platformConfig: any = {
              platform: p.platform,
              accountId: p.accountId,
              platformSpecificData: {}
            };

            // Instagram: Support Reel or Story
            if (p.platform === 'instagram') {
              const contentType = request.postTypes?.instagram || 'reel';
              platformConfig.platformSpecificData.contentType = contentType;
            }

            // Facebook: Support Feed or Story
            if (p.platform === 'facebook') {
              const contentType = request.postTypes?.facebook || 'feed';
              platformConfig.platformSpecificData.contentType = contentType;
            }

            // YouTube Shorts
            if (p.platform === 'youtube') {
              platformConfig.platformSpecificData = {
                title: request.title || fullCaption.substring(0, 100),
                category: request.brand === 'carz' ? 'Autos & Vehicles' : 'News & Politics',
                privacy: 'public',
                madeForKids: false,
                short: true // YouTube Shorts
              };
            }

            // TikTok
            if (p.platform === 'tiktok') {
              platformConfig.platformSpecificData.privacy = 'public';
            }

            return platformConfig;
          });

          // Build request body
          const requestBody: any = {
            content: fullCaption,
            platforms: platforms,
            mediaItems: [
              {
                type: 'video',
                url: request.videoUrl
              }
            ]
          };

          // Add scheduling
          if (request.scheduleTime) {
            requestBody.scheduledFor = request.scheduleTime;
            requestBody.timezone = 'America/Chicago'; // Central Time
          } else {
            // Immediate posting
            requestBody.publishNow = true;
          }

          console.log('🔍 Late API Request Body:', JSON.stringify(requestBody, null, 2));

          const response = await fetchWithTimeout(
            `${LATE_BASE_URL}/posts`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LATE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            },
            TIMEOUTS.EXTERNAL_API
          );

          console.log(`🔍 Late API Response Status: ${response.status} ${response.statusText}`);

          // Get response text first
          const responseText = await response.text();
          console.log(`🔍 Late API Response Body:`, responseText);

          if (!response.ok) {
            // Check for rate limit
            if (response.status === 429) {
              throw new RateLimitError('Late API rate limit exceeded', 60);
            }

            throw new Error(`Late API error: ${response.status} - ${responseText}`);
          }

          // Parse JSON response
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            throw new Error(`Late API returned invalid JSON: ${responseText}`);
          }

          // Extract post ID and validate it exists
          const postId = data.id || data.postId || data._id || data.post?.id || data.post?._id;

          if (!postId) {
            console.error('❌ Late API response missing post ID!');
            console.error('   Response data:', JSON.stringify(data, null, 2));
            throw new Error('Late API response missing post ID');
          }

          console.log(`✅ Posted to Late (${brandName}) successfully!`);
          console.log('   Post ID:', postId);
          if (data.scheduledFor) {
            console.log('   Scheduled for:', data.scheduledFor);
          }

          return {
            success: true,
            postId: postId,
            scheduledFor: data.scheduledFor || request.scheduleTime,
            platforms: platformAccounts.map(p => p.platform)
          };
        }); // End circuit breaker
      },
      {
        maxAttempts: 3,
        backoff: 'exponential',
        onRetry: (attempt, error) => {
          console.log(`Late retry ${attempt}:`, error.message);
        }
      }
    );

  } catch (error) {
    console.error('❌ Error posting to Late:', error);

    // Provide more specific error messages
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: `${ERROR_MESSAGES.RATE_LIMIT_EXCEEDED} Retry in ${error.retryAfter}s.`
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Schedule video post using Late
 * Drop-in replacement for scheduleVideoPost from metricool-api
 */
export async function scheduleVideoPost(
  videoUrl: string,
  caption: string,
  title: string,
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter')[] | any[],
  delay: 'immediate' | '1hour' | '2hours' | '4hours' | 'optimal' = 'immediate',
  brand: 'carz' | 'ownerfi' | 'podcast' = 'ownerfi'
): Promise<LatePostResponse> {
  // Calculate schedule time
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

  // Extract hashtags from caption
  const hashtagRegex = /#[\w]+/g;
  const hashtags = caption.match(hashtagRegex) || [];
  const cleanCaption = caption.replace(hashtagRegex, '').trim();

  return postToLate({
    videoUrl,
    caption: cleanCaption,
    title,
    hashtags,
    platforms: platforms as any,
    scheduleTime,
    brand
  });
}
