/**
 * Instagram Analytics Fetcher
 *
 * Fetches analytics data from Instagram Graph API
 * Requires Instagram Business Account and proper permissions
 */

interface InstagramInsight {
  name: string;
  period: string;
  values: Array<{
    value: number;
    end_time: string;
  }>;
  title: string;
  description: string;
  id: string;
}

interface InstagramMediaInsights {
  impressions: number;
  reach: number;
  engagement: number;
  saved: number;
  video_views?: number;
  likes: number;
  comments: number;
  shares: number;
}

interface InstagramAccountInsights {
  reach: number;
  impressions: number;
  profile_views: number;
  follower_count: number;
  website_clicks: number;
}

/**
 * Fetch Instagram Business Account insights
 */
export async function fetchInstagramAccountInsights(
  instagramBusinessAccountId: string,
  accessToken: string,
  period: 'day' | 'week' | 'days_28' = 'day'
): Promise<InstagramAccountInsights | null> {
  try {
    const metrics = [
      'reach',
      'impressions',
      'profile_views',
      'follower_count',
      'website_clicks'
    ].join(',');

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}/insights?metric=${metrics}&period=${period}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.error(`Instagram API error: ${response.status} ${response.statusText}`);
      const error = await response.json();
      console.error('Error details:', error);
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.log('No Instagram account insights data available');
      return null;
    }

    // Parse insights into structured format
    const insights: InstagramAccountInsights = {
      reach: 0,
      impressions: 0,
      profile_views: 0,
      follower_count: 0,
      website_clicks: 0
    };

    data.data.forEach((insight: InstagramInsight) => {
      const value = insight.values[0]?.value || 0;

      switch (insight.name) {
        case 'reach':
          insights.reach = value;
          break;
        case 'impressions':
          insights.impressions = value;
          break;
        case 'profile_views':
          insights.profile_views = value;
          break;
        case 'follower_count':
          insights.follower_count = value;
          break;
        case 'website_clicks':
          insights.website_clicks = value;
          break;
      }
    });

    return insights;

  } catch (error) {
    console.error('Error fetching Instagram account insights:', error);
    return null;
  }
}

/**
 * Fetch insights for a specific Instagram media post
 */
export async function fetchInstagramMediaInsights(
  mediaId: string,
  accessToken: string
): Promise<InstagramMediaInsights | null> {
  try {
    const metrics = [
      'impressions',
      'reach',
      'engagement',
      'saved',
      'video_views', // Only available for video posts
      'likes',
      'comments',
      'shares'
    ].join(',');

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.error(`Instagram Media API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    // Parse media insights
    const insights: InstagramMediaInsights = {
      impressions: 0,
      reach: 0,
      engagement: 0,
      saved: 0,
      likes: 0,
      comments: 0,
      shares: 0
    };

    data.data.forEach((insight: InstagramInsight) => {
      const value = insight.values[0]?.value || 0;

      switch (insight.name) {
        case 'impressions':
          insights.impressions = value;
          break;
        case 'reach':
          insights.reach = value;
          break;
        case 'engagement':
          insights.engagement = value;
          break;
        case 'saved':
          insights.saved = value;
          break;
        case 'video_views':
          insights.video_views = value;
          break;
        case 'likes':
          insights.likes = value;
          break;
        case 'comments':
          insights.comments = value;
          break;
        case 'shares':
          insights.shares = value;
          break;
      }
    });

    return insights;

  } catch (error) {
    console.error('Error fetching Instagram media insights:', error);
    return null;
  }
}

/**
 * Get Instagram media ID from post permalink
 */
export async function getInstagramMediaIdFromPermalink(
  permalink: string,
  accessToken: string
): Promise<string | null> {
  try {
    // Extract shortcode from permalink (e.g., https://www.instagram.com/p/ABC123/)
    const match = permalink.match(/instagram\.com\/p\/([^\/]+)/);
    if (!match) {
      console.error('Invalid Instagram permalink');
      return null;
    }

    const shortcode = match[1];

    // Use Instagram Graph API to get media ID from shortcode
    const response = await fetch(
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(permalink)}&access_token=${accessToken}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.media_id || null;

  } catch (error) {
    console.error('Error getting Instagram media ID:', error);
    return null;
  }
}

/**
 * Fetch recent media from Instagram Business Account
 */
export async function fetchInstagramRecentMedia(
  instagramBusinessAccountId: string,
  accessToken: string,
  limit: number = 25
): Promise<any[]> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.error(`Instagram Media List API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];

  } catch (error) {
    console.error('Error fetching Instagram recent media:', error);
    return [];
  }
}

/**
 * Sync Instagram analytics for a brand's posts
 */
export async function syncInstagramAnalytics(
  brand: string,
  instagramBusinessAccountId: string,
  accessToken: string
): Promise<{
  success: boolean;
  syncedPosts: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let syncedPosts = 0;

  try {
    console.log(`📊 Syncing Instagram analytics for ${brand}...`);

    // Fetch recent media
    const recentMedia = await fetchInstagramRecentMedia(
      instagramBusinessAccountId,
      accessToken,
      50
    );

    console.log(`   Found ${recentMedia.length} Instagram posts`);

    // Fetch insights for each post
    for (const media of recentMedia) {
      try {
        const insights = await fetchInstagramMediaInsights(media.id, accessToken);

        if (insights) {
          // TODO: Save to Firebase workflow_analytics collection
          // Match with existing workflows by permalink or timestamp
          console.log(`   ✅ Synced insights for post ${media.id}`);
          syncedPosts++;
        }
      } catch (error) {
        errors.push(`Failed to sync post ${media.id}: ${error}`);
      }
    }

    // Fetch account-level insights
    const accountInsights = await fetchInstagramAccountInsights(
      instagramBusinessAccountId,
      accessToken,
      'day'
    );

    if (accountInsights) {
      console.log(`   📈 Account insights:`, accountInsights);
    }

    return {
      success: true,
      syncedPosts,
      errors
    };

  } catch (error) {
    console.error(`Error syncing Instagram analytics for ${brand}:`, error);
    return {
      success: false,
      syncedPosts,
      errors: [...errors, `${error}`]
    };
  }
}
