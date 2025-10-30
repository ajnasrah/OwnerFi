#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function analyzeAllPlatforms() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('📱 COMPLETE PLATFORM PEAK TIME ANALYSIS\n');
  console.log('Analyzing: YouTube, Instagram, TikTok, Facebook, LinkedIn, Twitter, Threads\n');
  console.log('═'.repeat(100));

  // Fetch all posts
  let allPosts: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`https://getlate.dev/api/v1/analytics?limit=100&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    allPosts = allPosts.concat(data.posts || []);

    if (data.pagination && page < data.pagination.pages) {
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\nTotal posts fetched: ${allPosts.length}\n`);

  // Analyze each platform
  const platforms = ['youtube', 'instagram', 'tiktok', 'facebook', 'linkedin', 'twitter', 'threads'];

  for (const platformName of platforms) {
    console.log('═'.repeat(100));
    console.log(`\n📱 ${platformName.toUpperCase()}\n`);

    const platformPosts: any[] = [];

    allPosts.forEach(post => {
      if (post.platforms) {
        post.platforms.forEach((p: any) => {
          if (p.platform === platformName) {
            const analytics = p.analytics || {};
            const performance = platformName === 'youtube'
              ? (analytics.views || 0)
              : ((analytics.likes || 0) + (analytics.comments || 0));

            if (performance > 0 && post.publishedAt) {
              platformPosts.push({
                content: post.content || '',
                performance,
                publishedAt: post.publishedAt
              });
            }
          }
        });
      }
    });

    if (platformPosts.length === 0) {
      console.log('⚠️  No performance data found for this platform\n');
      continue;
    }

    console.log(`Total posts with data: ${platformPosts.length}`);

    // Analyze by hour
    const hourPerformance = new Map<number, { count: number; totalScore: number }>();

    platformPosts.forEach(post => {
      const hour = new Date(post.publishedAt).getHours();

      if (!hourPerformance.has(hour)) {
        hourPerformance.set(hour, { count: 0, totalScore: 0 });
      }

      const stats = hourPerformance.get(hour)!;
      stats.count++;
      stats.totalScore += post.performance;
    });

    console.log('\n⏰ BEST POSTING HOURS:\n');

    const sortedHours = Array.from(hourPerformance.entries())
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .slice(0, 5);

    sortedHours.forEach(([hour, stats], idx) => {
      const avgPerformance = (stats.totalScore / stats.count).toFixed(1);
      console.log(`   ${(idx + 1)}. ${hour.toString().padStart(2, '0')}:00 - ${stats.count} posts, avg ${avgPerformance} ${platformName === 'youtube' ? 'views' : 'engagement'}`);
    });

    // Analyze by day
    const dayPerformance = new Map<number, { count: number; totalScore: number }>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    platformPosts.forEach(post => {
      const day = new Date(post.publishedAt).getDay();

      if (!dayPerformance.has(day)) {
        dayPerformance.set(day, { count: 0, totalScore: 0 });
      }

      const stats = dayPerformance.get(day)!;
      stats.count++;
      stats.totalScore += post.performance;
    });

    console.log('\n📅 BEST POSTING DAYS:\n');

    const sortedDays = Array.from(dayPerformance.entries())
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .slice(0, 3);

    sortedDays.forEach(([day, stats], idx) => {
      const avgPerformance = (stats.totalScore / stats.count).toFixed(1);
      console.log(`   ${(idx + 1)}. ${dayNames[day]} - ${stats.count} posts, avg ${avgPerformance}`);
    });

    console.log('\n');
  }

  console.log('═'.repeat(100));
  console.log('\n✅ ANALYSIS COMPLETE\n');
  console.log('═'.repeat(100));

  // Summary recommendations
  console.log('\n🎯 RECOMMENDED POSTING TIMES BY PLATFORM:\n');
  console.log('Based on the analysis above, cluster your posts around:');
  console.log('(This will be used to configure queues)\n');
}

analyzeAllPlatforms().catch(console.error);
