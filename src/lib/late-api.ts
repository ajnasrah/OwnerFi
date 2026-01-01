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
const getLateAbdullahProfileId = () => process.env.LATE_ABDULLAH_PROFILE_ID?.trim();
const getLatePersonalProfileId = () => process.env.LATE_PERSONAL_PROFILE_ID?.trim();
const getLateBenefitProfileId = () => process.env.LATE_BENEFIT_PROFILE_ID?.trim();
const getLateGazaProfileId = () => process.env.LATE_GAZA_PROFILE_ID?.trim();

export interface LatePostRequest {
  videoUrl?: string; // For video posts
  imageUrl?: string; // For image posts
  caption: string;
  title?: string;
  hashtags?: string[];
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter' | 'pinterest' | 'reddit' | 'bluesky')[];
  scheduleTime?: string; // ISO 8601 format, or omit for immediate posting
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza';
  postTypes?: {
    instagram?: 'reel' | 'story' | 'feed'; // Added 'feed' for image posts
    facebook?: 'feed' | 'story';
  };
  useQueue?: boolean; // If true, automatically get next queue slot and mark as queued
  timezone?: string; // Timezone for scheduling (used with queue)
  firstComment?: string; // First comment to auto-post (boosts engagement + adds extra hashtags)
  strictMode?: boolean; // If true, fail if ANY requested platforms are missing (default: false - continues with available)
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
function getProfileId(brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza'): string | null {
  switch (brand) {
    case 'ownerfi':
      return getLateOwnerfiProfileId() || null;
    case 'benefit':
      return getLateBenefitProfileId() || getLateOwnerfiProfileId() || null; // Fallback to OwnerFi if no benefit profile
    case 'carz':
      return getLateCarzProfileId() || null;
    case 'abdullah':
      return getLateAbdullahProfileId() || null;
    case 'personal':
      return getLatePersonalProfileId() || null;
    case 'gaza':
      return getLateGazaProfileId() || null;
    default:
      return null;
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

    const accountsData = await response.json();

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

// In-memory cache to prevent duplicate posts (belt-and-suspenders approach)
// Key: hash of videoUrl+caption, Value: timestamp of last post
const recentPostsCache = new Map<string, number>();
const POST_DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a simple hash for deduplication
 */
function generatePostHash(videoUrl: string, caption: string): string {
  // Use first 100 chars of caption + video URL for hash
  const key = `${videoUrl}|${caption.substring(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
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

  // DEDUPLICATION CHECK: Prevent posting same video+caption within 10 minutes
  if (request.videoUrl) {
    const postHash = generatePostHash(request.videoUrl, request.caption);
    const lastPostTime = recentPostsCache.get(postHash);

    if (lastPostTime && (Date.now() - lastPostTime) < POST_DEDUP_WINDOW_MS) {
      const minutesAgo = Math.round((Date.now() - lastPostTime) / 60000);
      console.warn(`⚠️  DUPLICATE POST BLOCKED: Same video+caption was posted ${minutesAgo} minutes ago`);
      console.warn(`   Video URL: ${request.videoUrl.substring(0, 60)}...`);
      console.warn(`   Caption: ${request.caption.substring(0, 60)}...`);
      return {
        success: false,
        error: `Duplicate post blocked: Same content was posted ${minutesAgo} minutes ago`
      };
    }

    // Clean up old entries from cache (keep it from growing indefinitely)
    const now = Date.now();
    for (const [key, time] of recentPostsCache.entries()) {
      if (now - time > POST_DEDUP_WINDOW_MS) {
        recentPostsCache.delete(key);
      }
    }

    // Add to cache BEFORE posting (optimistic - will be accurate after successful post)
    recentPostsCache.set(postHash, now);
  }

  // Get profile ID for brand
  const profileId = getProfileId(request.brand);
  if (!profileId) {
    const brandNameMap: Record<string, string> = {
      'carz': 'Carz',
      'ownerfi': 'OwnerFi',
      'benefit': 'Benefit',
      'abdullah': 'Abdullah',
      'personal': 'Personal',
      'gaza': 'Gaza'
    };
    const brandName = brandNameMap[request.brand] || request.brand;
    console.error(`❌ Profile ID not configured for ${brandName}`);
    return {
      success: false,
      error: `Profile ID not configured for ${brandName}. Set LATE_${request.brand.toUpperCase()}_PROFILE_ID in .env`
    };
  }

  try {
    // If useQueue is true, we'll use Late.so's built-in queue (no explicit scheduleTime)
    // Otherwise, use the provided scheduleTime
    const scheduleTime = request.useQueue ? undefined : request.scheduleTime;
    const timezone = request.timezone;

    if (request.useQueue) {
      console.log(`📅 Using Late.so's built-in queue for ${request.brand} (no explicit schedule time)`);
      // Don't calculate a scheduleTime - let Late.so's queue handle it
      // We'll just set queuedFromProfile later
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

      // STRICT MODE: If enabled, fail if ANY platforms are missing
      if (request.strictMode) {
        console.error(`🚫 STRICT MODE: Failing post because ${missingPlatforms.length} platform(s) missing`);
        return {
          success: false,
          error: `Strict mode enabled: ${errorMsg}`,
          skippedPlatforms: missingPlatforms
        };
      }

      // If SOME platforms are missing, log warning and continue with available platforms
      console.warn(`⚠️  Continuing with ${platformAccounts.length}/${request.platforms.length} platforms (skipped: ${missingPlatforms.join(', ')})`);
    }

    const brandNameMap: Record<string, string> = {
      'carz': 'Carz',
      'ownerfi': 'OwnerFi',
      'benefit': 'Benefit',
      'abdullah': 'Abdullah',
      'personal': 'Personal',
      'gaza': 'Gaza'
    };
    const brandName = brandNameMap[request.brand] || request.brand;
    console.log(`📤 Posting to Late (${brandName})...`);
    console.log('   Profile ID:', profileId);
    console.log('   Platforms:', platformAccounts.map(p => p.platform).join(', '));

    return await retry(
      async () => {
        // Build caption with hashtags
        let fullCaption = request.caption;
        if (request.hashtags && request.hashtags.length > 0) {
          const formattedHashtags = request.hashtags
            .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
            .join(' ');
          fullCaption = `${request.caption}\n\n${formattedHashtags}`;
        }

        console.log('   Caption:', fullCaption.substring(0, 100) + '...');

        // Use circuit breaker to prevent cascading failures
        return await circuitBreakers.late.execute(async () => {
          // Build platforms with story support
          const platforms = platformAccounts.map(p => {
            const platformConfig: any = {
              platform: p.platform,
              accountId: p.accountId,
              platformSpecificData: {}
            };

            // Instagram: Support Feed (image), Reel (video), or Story
            if (p.platform === 'instagram') {
              // Default to 'feed' for images, 'reel' for videos
              const defaultType = request.imageUrl ? 'feed' : 'reel';
              const contentType = request.postTypes?.instagram || defaultType;
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
              } else if (request.brand === 'ownerfi' || request.brand === 'benefit') {
                category = 'Howto & Style'; // Best fit for real estate content
              } else if (request.brand === 'gaza') {
                category = 'News & Politics'; // Gaza humanitarian news
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
          const mediaUrl = request.videoUrl || request.imageUrl;
          const mediaType = request.videoUrl ? 'video' : 'image';

          if (!mediaUrl) {
            throw new Error('Either videoUrl or imageUrl must be provided');
          }

          const requestBody: any = {
            content: fullCaption,
            platforms: platforms,
            mediaItems: [
              {
                type: mediaType,
                url: mediaUrl
              }
            ]
          };

          // Add first comment if provided (boosts engagement + extra hashtags)
          if (request.firstComment) {
            requestBody.firstComment = request.firstComment;
          }

          // Add scheduling or queue
          // IMPORTANT: Use consistent timezone (America/Chicago / CST) for all scheduling
          const effectiveTimezone = timezone || 'America/Chicago';

          if (request.useQueue) {
            // Use Late.so's built-in queue - set queuedFromProfile AND timezone
            requestBody.queuedFromProfile = profileId;
            requestBody.timezone = effectiveTimezone;
            console.log(`   Adding to Late.so queue for profile: ${profileId} (timezone: ${requestBody.timezone})`);
          } else if (scheduleTime) {
            // Explicit schedule time provided
            requestBody.scheduledFor = scheduleTime;
            requestBody.timezone = effectiveTimezone;
            console.log(`   Scheduling for: ${scheduleTime} (${effectiveTimezone})`);
          } else {
            // Immediate posting
            requestBody.publishNow = true;
            console.log(`   Publishing immediately`);
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
        caption: request.caption, // Use original caption since fullCaption is out of scope
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
export async function getNextQueueSlot(brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza'): Promise<{ nextSlot: string; timezone: string } | null> {
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
export async function getQueueSchedule(brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza'): Promise<any> {
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
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
  slots: { dayOfWeek: number; time: string }[],
  timezone: string = 'America/Chicago', // CST - consistent with brand posting schedule
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
 *
 * ⚠️ IMPORTANT: This function now ALWAYS uses GetLate's queue system
 * for optimal scheduling. The delay parameter is deprecated but kept
 * for backwards compatibility.
 */
export async function scheduleVideoPost(
  videoUrl: string,
  caption: string,
  title: string,
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter')[] | any[],
  delay: 'immediate' | '1hour' | '2hours' | '4hours' | 'optimal' = 'immediate',
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza' = 'ownerfi',
  firstComment?: string // Optional first comment for engagement boost
): Promise<LatePostResponse> {
  // Extract hashtags from caption
  const hashtagRegex = /#[\w]+/g;
  const hashtags = caption.match(hashtagRegex) || [];
  const cleanCaption = caption.replace(hashtagRegex, '').trim();

  // ⚠️ ALWAYS use GetLate's queue system for optimal scheduling
  // The 'delay' parameter is now deprecated - GetLate handles optimal timing
  console.log(`📅 Using GetLate queue for ${brand} (delay parameter "${delay}" ignored - queue handles optimal timing)`);

  return postToLate({
    videoUrl,
    caption: cleanCaption,
    title,
    hashtags,
    platforms: platforms as any,
    brand,
    firstComment, // Pass through first comment
    useQueue: true, // ✅ ALWAYS use GetLate's queue system
    timezone: 'America/Chicago' // Use CST timezone
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
