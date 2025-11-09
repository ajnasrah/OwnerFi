// Late API Integration
// Complete replacement for Metricool - handles all social media posting
// Supports Instagram, TikTok, YouTube, Facebook, LinkedIn, Twitter, Threads, Pinterest, Reddit, Bluesky

import { fetchWithTimeout, retry, TIMEOUTS, circuitBreakers, RateLimitError } from './api-utils';
import { ERROR_MESSAGES } from '@/config/constants';

const LATE_BASE_URL = 'https://getlate.dev/api/v1';

// Late API credentials - use getters to read at runtime, not at module load time
// Trim to remove any trailing newlines or whitespace
const getLateApiKey = () => process.env.LATE_API_KEY?.trim();
const getLateOwnerfiProfileId = () => process.env.LATE_OWNERFI_PROFILE_ID?.trim();
const getLateCarzProfileId = () => process.env.LATE_CARZ_PROFILE_ID?.trim();
const getLatePodcastProfileId = () => process.env.LATE_PODCAST_PROFILE_ID?.trim();
const getLateVassDistroProfileId = () => process.env.LATE_VASSDISTRO_PROFILE_ID?.trim();
const getLateAbdullahProfileId = () => process.env.LATE_ABDULLAH_PROFILE_ID?.trim();

export interface LatePostRequest {
  videoUrl: string;
  caption: string;
  title?: string;
  hashtags?: string[];
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter' | 'pinterest' | 'reddit' | 'bluesky')[];
  scheduleTime?: string; // ISO 8601 format, or omit for immediate posting
  brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'vassdistro' | 'benefit' | 'abdullah';
  postTypes?: {
    instagram?: 'reel' | 'story';
    facebook?: 'feed' | 'story';
  };
  useQueue?: boolean; // If true, automatically get next queue slot and mark as queued
  timezone?: string; // Timezone for scheduling (used with queue)
  firstComment?: string; // First comment to auto-post (boosts engagement + adds extra hashtags)
}

export interface LatePostResponse {
  success: boolean;
  postId?: string;
  scheduledFor?: string;
  platforms?: string[];
  skippedPlatforms?: string[]; // Platforms that were requested but skipped due to missing accounts
  error?: string;
  warning?: string; // Non-fatal warnings (e.g., some platforms skipped)
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
function getProfileId(brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'vassdistro' | 'benefit' | 'abdullah'): string | null {
  switch (brand) {
    case 'ownerfi':
    case 'property': // Property videos use OwnerFi profile
    case 'benefit': // Benefit videos also use OwnerFi profile
      return getLateOwnerfiProfileId() || null;
    case 'carz':
      return getLateCarzProfileId() || null;
    case 'podcast':
      return getLatePodcastProfileId() || null;
    case 'vassdistro':
      return getLateVassDistroProfileId() || null;
    case 'abdullah':
      return getLateAbdullahProfileId() || null;
  }
}

/**
 * Get all profiles from Late
 */
export async function getLateProfiles(): Promise<LateProfile[]> {
  const LATE_API_KEY = getLateApiKey();
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
      TIMEOUTS.LATE_API
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
  const LATE_API_KEY = getLateApiKey();
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
      TIMEOUTS.LATE_API
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
  const LATE_API_KEY = getLateApiKey();
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
    const brandNameMap: Record<string, string> = {
      'carz': 'Carz',
      'ownerfi': 'OwnerFi',
      'podcast': 'Podcast',
      'property': 'Property',
      'vassdistro': 'VassDistro',
      'benefit': 'Benefit',
      'abdullah': 'Abdullah'
    };
    const brandName = brandNameMap[request.brand] || request.brand;
    console.error(`❌ Profile ID not configured for ${brandName}`);
    return {
      success: false,
      error: `Profile ID not configured for ${brandName}. Set LATE_${request.brand.toUpperCase()}_PROFILE_ID in .env`
    };
  }

  try {
    // If useQueue is true, get the next available queue slot
    let scheduleTime = request.scheduleTime;
    let timezone = request.timezone;

    if (request.useQueue) {
      console.log(`📅 Using queue for ${request.brand}...`);
      const queueSlot = await getNextQueueSlot(request.brand);

      if (queueSlot) {
        scheduleTime = queueSlot.nextSlot;
        timezone = queueSlot.timezone;
        console.log(`   Next queue slot: ${scheduleTime} (${timezone})`);
      } else {
        console.warn('⚠️  Failed to get queue slot, falling back to immediate posting');
      }
    }

    // First, get the accounts for this profile to get accountIds
    const accounts = await getLateAccounts(profileId);

    // Map platform names to account IDs
    const missingPlatforms: string[] = [];
    const platformAccounts = request.platforms
      .map(platform => {
        const account = accounts.find(acc => acc.platform.toLowerCase() === platform.toLowerCase());
        if (!account) {
          console.warn(`⚠️  No ${platform} account found for profile ${profileId}`);
          missingPlatforms.push(platform);
          return null;
        }
        return {
          platform: platform,
          accountId: account._id // Late API uses MongoDB-style _id field
        };
      })
      .filter(Boolean) as { platform: string; accountId: string }[];

    // Check for missing platforms
    if (missingPlatforms.length > 0) {
      const errorMsg = `Missing connected accounts for platforms: ${missingPlatforms.join(', ')}. Please reconnect these accounts in Late.dev`;
      console.error(`❌ ${errorMsg}`);

      // If ALL platforms are missing, fail the entire post
      if (platformAccounts.length === 0) {
        return {
          success: false,
          error: errorMsg
        };
      }

      // If SOME platforms are missing, log warning and continue with available platforms
      console.warn(`⚠️  Continuing with ${platformAccounts.length}/${request.platforms.length} platforms (skipped: ${missingPlatforms.join(', ')})`);
    }

    // Build caption with hashtags
    let fullCaption = request.caption;
    if (request.hashtags && request.hashtags.length > 0) {
      const formattedHashtags = request.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      fullCaption = `${request.caption}\n\n${formattedHashtags}`;
    }

    const brandNameMap: Record<string, string> = {
      'carz': 'Carz',
      'ownerfi': 'OwnerFi',
      'podcast': 'Podcast',
      'property': 'Property',
      'vassdistro': 'VassDistro',
      'abdullah': 'Abdullah'
    };
    const brandName = brandNameMap[request.brand] || request.brand;
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
              // Category mapping by brand
              let category = 'People & Blogs'; // Default
              if (request.brand === 'carz') {
                category = 'Autos & Vehicles';
              } else if (request.brand === 'ownerfi') {
                category = 'Howto & Style'; // Best fit for real estate content
              } else if (request.brand === 'podcast') {
                category = 'Education'; // Podcast content
              }

              platformConfig.platformSpecificData = {
                title: request.title || fullCaption.substring(0, 100),
                category: category,
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

          // Add first comment if provided (boosts engagement + extra hashtags)
          if (request.firstComment) {
            requestBody.firstComment = request.firstComment;
          }

          // Add scheduling
          if (scheduleTime) {
            requestBody.scheduledFor = scheduleTime;
            requestBody.timezone = timezone || 'America/New_York'; // Use queue timezone or default to Eastern

            // If this was queued, mark it with queuedFromProfile
            if (request.useQueue) {
              requestBody.queuedFromProfile = profileId;
            }
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
            TIMEOUTS.LATE_API
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

          // Track Late cost
          try {
            const { trackCost } = await import('@/lib/cost-tracker');
            await trackCost(
              request.brand,
              'late',
              'social_post',
              1, // 1 post
              0, // Late is flat rate subscription ($50/month), track individual posts as $0
              undefined // No specific workflow ID available here
            );
            console.log(`💰 [${brandName}] Tracked Late cost: $0.00 (flat rate subscription)`);
          } catch (costError) {
            console.error(`⚠️  Failed to track Late cost:`, costError);
          }

          const result: LatePostResponse = {
            success: true,
            postId: postId,
            scheduledFor: data.scheduledFor || request.scheduleTime,
            platforms: platformAccounts.map(p => p.platform)
          };

          // Add warning if some platforms were skipped
          if (missingPlatforms.length > 0) {
            result.skippedPlatforms = missingPlatforms;
            result.warning = `Posted to ${platformAccounts.length}/${request.platforms.length} platforms. Skipped: ${missingPlatforms.join(', ')} (accounts not connected)`;
          }

          return result;
        }); // End circuit breaker
      },
      {
        maxAttempts: 5, // Increased from 3 to 5 to handle Late.dev platform timeouts
        backoff: 'exponential',
        onRetry: (attempt, error) => {
          console.log(`📡 Late API retry ${attempt}/5:`, error.message);
          console.log(`   Platforms attempted: ${platformAccounts.map(p => p.platform).join(', ')}`);
        }
      }
    );

  } catch (error) {
    console.error('❌ Error posting to Late:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure to database for tracking
    try {
      await logLateFailure({
        brand: request.brand,
        profileId: profileId || undefined,
        platforms: request.platforms,
        caption: fullCaption || request.caption,
        videoUrl: request.videoUrl,
        error: errorMessage,
      });
    } catch (logError) {
      console.error('Failed to log Late failure:', logError);
    }

    // Provide more specific error messages
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: `${ERROR_MESSAGES.RATE_LIMIT_EXCEEDED} Retry in ${error.retryAfter}s.`
      };
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get the next available queue slot for a profile
 */
export async function getNextQueueSlot(brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'vassdistro' | 'benefit'): Promise<{ nextSlot: string; timezone: string } | null> {
  const profileId = getProfileId(brand);
  const LATE_API_KEY = getLateApiKey();
  if (!profileId || !LATE_API_KEY) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `${LATE_BASE_URL}/queue/next-slot?profileId=${profileId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      },
      TIMEOUTS.LATE_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️  Failed to get queue slot: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    return {
      nextSlot: data.nextSlot,
      timezone: data.timezone
    };
  } catch (error) {
    console.error('❌ Error getting queue slot:', error);
    return null;
  }
}

/**
 * Get queue schedule for a profile
 */
export async function getQueueSchedule(brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'vassdistro' | 'benefit'): Promise<any> {
  const profileId = getProfileId(brand);
  const LATE_API_KEY = getLateApiKey();
  if (!profileId || !LATE_API_KEY) {
    throw new Error('Profile ID or API key not configured');
  }

  const response = await fetchWithTimeout(
    `${LATE_BASE_URL}/queue/slots?profileId=${profileId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    },
    TIMEOUTS.LATE_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get queue schedule: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Set or update queue schedule for a profile
 */
export async function setQueueSchedule(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'vassdistro' | 'benefit',
  slots: { dayOfWeek: number; time: string }[],
  timezone: string = 'America/New_York',
  reshuffleExisting: boolean = false
): Promise<any> {
  const profileId = getProfileId(brand);
  const LATE_API_KEY = getLateApiKey();
  if (!profileId || !LATE_API_KEY) {
    throw new Error('Profile ID or API key not configured');
  }

  const response = await fetchWithTimeout(
    `${LATE_BASE_URL}/queue/slots`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId,
        timezone,
        slots,
        active: true,
        reshuffleExisting
      })
    },
    TIMEOUTS.LATE_API
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to set queue schedule: ${response.status} - ${errorText}`);
  }

  return response.json();
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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'vassdistro' | 'benefit' | 'abdullah' = 'ownerfi',
  firstComment?: string // Optional first comment for engagement boost
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
    brand,
    firstComment // Pass through first comment
  });
}

/**
 * Log Late posting failure to database for tracking
 */
async function logLateFailure(data: {
  brand: string;
  profileId?: string;
  platforms: string[];
  caption: string;
  videoUrl: string;
  error: string;
  postId?: string;
  workflowId?: string;
}): Promise<void> {
  try {
    // Only log in production/server environment
    if (typeof window !== 'undefined') {
      return;
    }

    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/late-failures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('Failed to log Late failure:', await response.text());
    }
  } catch (error) {
    console.error('Error logging Late failure:', error);
  }
}
