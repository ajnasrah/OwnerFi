#!/usr/bin/env npx tsx

/**
 * Platform Analytics Diagnostic Script
 *
 * Pulls real analytics data from Late.dev API for each platform
 * and displays the exact data structure and available metrics
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';

interface LatePost {
  _id: string;
  profileId: string;
  scheduledFor: string;
  postedAt?: string;
  content?: string;
  status: string;
  platforms: Array<{
    platform: string;
    accountId: string;
    platformPostId?: string;
    status?: string;
    analytics?: any;
    stats?: any;
  }>;
}

/**
 * Fetch posts from Late.dev API
 */
async function fetchLatePosts(profileId: string, limit: number = 20): Promise<LatePost[]> {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  if (!LATE_API_KEY) {
    throw new Error('❌ LATE_API_KEY not found in environment variables');
  }

  const params = new URLSearchParams({
    profileId,
    limit: limit.toString()
    // Don't filter by status - get all posts to see what's available
  });

  console.log(`🔍 Fetching posts from Late.dev API...`);

  const response = await fetch(
    `${LATE_BASE_URL}/posts?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Late API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.posts || data.data || [];
}

/**
 * Analyze platform data structure
 */
function analyzePlatformData(posts: LatePost[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 PLATFORM ANALYTICS DATA STRUCTURE ANALYSIS');
  console.log('='.repeat(80) + '\n');

  // Group by platform
  const platformData = new Map<string, any[]>();

  posts.forEach(post => {
    if (!post.platforms || !Array.isArray(post.platforms)) {
      return;
    }

    post.platforms.forEach(p => {
      const platform = p.platform.toLowerCase();
      if (!platformData.has(platform)) {
        platformData.set(platform, []);
      }

      const analytics = p.analytics || p.stats || {};

      if (Object.keys(analytics).length > 0) {
        platformData.get(platform)!.push({
          postId: post._id,
          scheduledFor: post.scheduledFor,
          postedAt: post.postedAt,
          platformPostId: p.platformPostId,
          status: p.status,
          analytics: analytics,
          rawPlatformData: p
        });
      }
    });
  });

  console.log(`📈 Found data for ${platformData.size} platforms\n`);

  // Analyze each platform
  platformData.forEach((posts, platform) => {
    console.log('─'.repeat(80));
    console.log(`🎯 PLATFORM: ${platform.toUpperCase()}`);
    console.log('─'.repeat(80));
    console.log(`Total posts with analytics: ${posts.length}\n`);

    if (posts.length === 0) {
      console.log('⚠️  No analytics data available\n');
      return;
    }

    // Get all unique metric keys across all posts
    const allMetrics = new Set<string>();
    posts.forEach(post => {
      Object.keys(post.analytics).forEach(key => allMetrics.add(key));
    });

    console.log(`📋 Available Metrics (${allMetrics.size}):`);
    allMetrics.forEach(metric => {
      console.log(`   • ${metric}`);
    });

    // Show sample data (first 3 posts with actual values)
    console.log(`\n📊 Sample Data (showing first 3 posts with values > 0):\n`);

    const postsWithData = posts.filter(p => {
      const analytics = p.analytics;
      return Object.values(analytics).some((val: any) =>
        typeof val === 'number' && val > 0
      );
    });

    const samplesToShow = Math.min(3, postsWithData.length);

    if (samplesToShow === 0) {
      console.log('⚠️  No posts with non-zero analytics values\n');
    } else {
      postsWithData.slice(0, samplesToShow).forEach((post, idx) => {
        console.log(`   ${idx + 1}. Post ${post.postId.substring(0, 12)}...`);
        console.log(`      Posted: ${post.postedAt || 'N/A'}`);
        console.log(`      Platform Post ID: ${post.platformPostId || 'N/A'}`);
        console.log(`      Analytics:`);

        Object.entries(post.analytics).forEach(([key, value]) => {
          if (typeof value === 'number') {
            console.log(`         ${key}: ${value.toLocaleString()}`);
          } else {
            console.log(`         ${key}: ${JSON.stringify(value)}`);
          }
        });
        console.log('');
      });
    }

    // Calculate averages for numeric fields
    console.log(`📊 Average Values Across All Posts:\n`);

    Array.from(allMetrics).forEach(metric => {
      const values = posts
        .map(p => p.analytics[metric])
        .filter((val): val is number => typeof val === 'number');

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const nonZero = values.filter(v => v > 0).length;

        console.log(`   ${metric}:`);
        console.log(`      Avg: ${avg.toFixed(2)} | Max: ${max} | Min: ${min} | Non-zero: ${nonZero}/${values.length}`);
      }
    });

    // Show raw data structure of first post for debugging
    console.log(`\n🔍 Raw Data Structure (first post):\n`);
    console.log(JSON.stringify(posts[0].rawPlatformData, null, 2));
    console.log('\n');
  });

  // Summary
  console.log('='.repeat(80));
  console.log('📝 SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nPlatforms analyzed: ${Array.from(platformData.keys()).join(', ')}\n`);

  platformData.forEach((posts, platform) => {
    const postsWithData = posts.filter(p =>
      Object.values(p.analytics).some((val: any) =>
        typeof val === 'number' && val > 0
      )
    );
    console.log(`${platform}: ${postsWithData.length}/${posts.length} posts with data`);
  });
  console.log('');
}

/**
 * Main function
 */
async function main() {
  const brand = process.argv[2] || 'ownerfi';

  console.log(`\n🚀 Platform Analytics Diagnostic Tool`);
  console.log(`   Brand: ${brand}`);
  console.log(`   Date: ${new Date().toISOString()}\n`);

  // Get profile ID for brand
  const profileIdMap: Record<string, string | undefined> = {
    'carz': process.env.LATE_CARZ_PROFILE_ID,
    'ownerfi': process.env.LATE_OWNERFI_PROFILE_ID,
    'podcast': process.env.LATE_PODCAST_PROFILE_ID,
    'vassdistro': process.env.LATE_VASSDISTRO_PROFILE_ID,
    'abdullah': process.env.LATE_ABDULLAH_PROFILE_ID,
  };

  const profileId = profileIdMap[brand];

  if (!profileId) {
    console.error(`❌ Profile ID not configured for brand: ${brand}`);
    console.log(`\nAvailable brands: ${Object.keys(profileIdMap).join(', ')}`);
    process.exit(1);
  }

  try {
    // Fetch posts
    const posts = await fetchLatePosts(profileId, 50); // Get last 50 posts

    if (posts.length === 0) {
      console.log('⚠️  No posts found for this profile');
      process.exit(0);
    }

    console.log(`✅ Found ${posts.length} posts\n`);

    // Show status breakdown
    const statusCounts = posts.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`📊 Status breakdown:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('');

    // Filter to only posts with platform data
    const postsWithPlatforms = posts.filter(p =>
      p.platforms && p.platforms.length > 0
    );
    console.log(`📌 ${postsWithPlatforms.length} posts have platform data\n`);

    if (postsWithPlatforms.length === 0) {
      console.log('⚠️  No posts with platform data to analyze');
      process.exit(0);
    }

    // Analyze platform data
    analyzePlatformData(postsWithPlatforms);

    console.log('✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
}

// Run the script
main();
