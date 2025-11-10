#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function analyzeAbdullahPeaks() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('📊 ABDULLAH BRAND - PLATFORM PEAK ANALYSIS\n');
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

  // Filter for Abdullah content (personal brand posts)
  const abdullahPosts = allPosts.filter(post => {
    const content = (post.content || '').toLowerCase();
    // Abdullah posts likely have personal/mindset/business themes
    // Or we can check by profile - but let's look for patterns
    return (
      content.includes('abdullah') ||
      content.includes('mindset') ||
      content.includes('freedom') ||
      content.includes('business') ||
      content.includes('money') ||
      content.includes('entrepreneur')
    );
  });

  console.log(`\nTotal posts analyzed: ${allPosts.length}`);
  console.log(`Abdullah posts found: ${abdullahPosts.length}\n`);

  if (abdullahPosts.length === 0) {
    console.log('⚠️  No Abdullah posts found in analytics.');
    console.log('Using general platform peak data instead:\n');

    console.log('📱 RECOMMENDED PEAK TIMES (from overall analysis):\n');
    console.log('YouTube:           8:00 AM  (84% success rate, 426 avg views)');
    console.log('Instagram:         2:00 PM  (56% success rate, peak engagement)');
    console.log('TikTok:            6:00 PM  (evening engagement)');
    console.log('Facebook:          2:00 PM  (similar to Instagram)');
    console.log('LinkedIn:          10:00 AM (business hours)');
    console.log('Twitter/Threads:   9:00 AM  (morning engagement)');

    console.log('\n🎯 ABDULLAH QUEUE RECOMMENDATION (10 posts/day):\n');
    console.log('Based on general platform peaks, distribute 10 posts:');
    console.log('   3 posts @ 8:00 AM window  (YouTube, Twitter, LinkedIn)');
    console.log('   4 posts @ 2:00 PM window  (Instagram, Facebook, peak time)');
    console.log('   3 posts @ 6:00 PM window  (TikTok, evening engagement)');

    console.log('\n📅 SUGGESTED SCHEDULE:\n');
    console.log('Morning cluster (8 AM - YouTube/Twitter/LinkedIn):');
    console.log('   7:45 AM, 8:00 AM, 8:30 AM');
    console.log('\nAfternoon cluster (2 PM - Instagram/Facebook peak):');
    console.log('   1:30 PM, 2:00 PM, 2:30 PM, 2:45 PM');
    console.log('\nEvening cluster (6 PM - TikTok/Threads):');
    console.log('   5:45 PM, 6:00 PM, 6:30 PM');

    return;
  }

  // Analyze platform performance for Abdullah
  const platformStats: Record<string, {
    posts: number;
    totalPerformance: number;
    avgPerformance: number;
    bestHours: Map<number, number>;
  }> = {};

  abdullahPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        const platform = p.platform;
        const analytics = p.analytics || {};

        if (!platformStats[platform]) {
          platformStats[platform] = {
            posts: 0,
            totalPerformance: 0,
            avgPerformance: 0,
            bestHours: new Map()
          };
        }

        const stats = platformStats[platform];
        stats.posts++;

        // Calculate performance score
        const performance = platform === 'youtube'
          ? (analytics.views || 0)
          : ((analytics.likes || 0) + (analytics.comments || 0));

        stats.totalPerformance += performance;

        // Track by hour
        if (post.publishedAt && performance > 0) {
          const hour = new Date(post.publishedAt).getHours();
          stats.bestHours.set(hour, (stats.bestHours.get(hour) || 0) + performance);
        }
      });
    }
  });

  // Calculate averages
  Object.keys(platformStats).forEach(platform => {
    const stats = platformStats[platform];
    stats.avgPerformance = stats.posts > 0 ? stats.totalPerformance / stats.posts : 0;
  });

  console.log('📊 ABDULLAH PLATFORM PERFORMANCE:\n');

  Object.entries(platformStats)
    .sort((a, b) => b[1].avgPerformance - a[1].avgPerformance)
    .forEach(([platform, stats]) => {
      console.log(`${platform.toUpperCase()}:`);
      console.log(`   Posts: ${stats.posts}`);
      console.log(`   Avg Performance: ${stats.avgPerformance.toFixed(1)}`);

      if (stats.bestHours.size > 0) {
        const topHours = Array.from(stats.bestHours.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        console.log('   Best Hours:');
        topHours.forEach(([hour, score]) => {
          console.log(`      ${hour.toString().padStart(2, '0')}:00 (score: ${Math.round(score)})`);
        });
      }
      console.log('');
    });

  console.log('═'.repeat(100));
}

analyzeAbdullahPeaks().catch(console.error);
