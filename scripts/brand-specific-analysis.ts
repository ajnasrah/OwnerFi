#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function brandSpecificAnalysis() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('🏢 BRAND-SPECIFIC ANALYTICS ANALYSIS\n');
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

  console.log(`\nTotal posts across all brands: ${allPosts.length}\n`);

  // ============================================================================
  // DETECT BRANDS FROM CONTENT
  // ============================================================================

  const brandPosts = {
    carz: [] as any[],
    ownerfi: [] as any[],
    podcast: [] as any[],
    other: [] as any[],
  };

  allPosts.forEach(post => {
    const content = (post.content || '').toLowerCase();
    const caption = content;

    // Classify by content keywords
    if (
      caption.includes('car') ||
      caption.includes('vehicle') ||
      caption.includes('ev') ||
      caption.includes('electric') ||
      caption.includes('tesla') ||
      caption.includes('cadillac') ||
      caption.includes('dealer') ||
      caption.includes('wholesale')
    ) {
      brandPosts.carz.push(post);
    } else if (
      caption.includes('home') ||
      caption.includes('house') ||
      caption.includes('owner financ') ||
      caption.includes('real estate') ||
      caption.includes('mortgage') ||
      caption.includes('rent') ||
      caption.includes('credit score') ||
      caption.includes('homeowner')
    ) {
      brandPosts.ownerfi.push(post);
    } else if (
      caption.includes('on ') && (
        caption.includes('dr.') ||
        caption.includes('coach') ||
        caption.includes('expert') ||
        caption.match(/\w+ \w+ on \w+/)
      )
    ) {
      brandPosts.podcast.push(post);
    } else {
      brandPosts.other.push(post);
    }
  });

  console.log('📊 POSTS BY BRAND:');
  console.log(`   Carz: ${brandPosts.carz.length} posts`);
  console.log(`   OwnerFi: ${brandPosts.ownerfi.length} posts`);
  console.log(`   Podcast: ${brandPosts.podcast.length} posts`);
  console.log(`   Other/Unknown: ${brandPosts.other.length} posts\n`);

  // ============================================================================
  // ANALYZE EACH BRAND SEPARATELY
  // ============================================================================

  for (const [brandName, posts] of Object.entries(brandPosts)) {
    if (posts.length === 0) continue;

    console.log('═'.repeat(100));
    console.log(`\n🏢 ${brandName.toUpperCase()} BRAND ANALYSIS\n`);
    console.log('═'.repeat(100));

    // Platform breakdown
    const platformStats = {
      youtube: { posts: 0, views: 0, likes: 0, comments: 0 },
      instagram: { posts: 0, likes: 0, comments: 0, engagement: 0 },
      tiktok: { posts: 0, likes: 0, comments: 0, engagement: 0 },
      facebook: { posts: 0, likes: 0, comments: 0, engagement: 0 },
    };

    posts.forEach(post => {
      if (post.platforms) {
        post.platforms.forEach((p: any) => {
          const platform = p.platform;
          const analytics = p.analytics || {};

          if (platformStats[platform as keyof typeof platformStats]) {
            const stats = platformStats[platform as keyof typeof platformStats];
            stats.posts++;

            if (platform === 'youtube') {
              stats.views += analytics.views || 0;
            }

            stats.likes += analytics.likes || 0;
            stats.comments += analytics.comments || 0;

            if (platform !== 'youtube') {
              (stats as any).engagement = (stats.likes || 0) + (stats.comments || 0);
            }
          }
        });
      }
    });

    console.log('\n📱 PLATFORM PERFORMANCE:\n');

    if (platformStats.youtube.posts > 0) {
      console.log('YOUTUBE:');
      console.log(`   Posts: ${platformStats.youtube.posts}`);
      console.log(`   Total Views: ${platformStats.youtube.views.toLocaleString()}`);
      console.log(`   Avg Views: ${Math.round(platformStats.youtube.views / platformStats.youtube.posts)}`);
      console.log(`   Total Likes: ${platformStats.youtube.likes}`);
      console.log(`   Total Comments: ${platformStats.youtube.comments}\n`);
    }

    if (platformStats.instagram.posts > 0) {
      console.log('INSTAGRAM:');
      console.log(`   Posts: ${platformStats.instagram.posts}`);
      console.log(`   Total Engagement: ${platformStats.instagram.engagement}`);
      console.log(`   Avg Engagement: ${(platformStats.instagram.engagement / platformStats.instagram.posts).toFixed(1)}`);
      console.log(`   Total Likes: ${platformStats.instagram.likes}`);
      console.log(`   Total Comments: ${platformStats.instagram.comments}\n`);
    }

    // Top performers for this brand
    const postsWithData = posts.filter(p => {
      const hasYoutubeViews = p.platforms?.some((plat: any) =>
        plat.platform === 'youtube' && (plat.analytics?.views || 0) > 0
      );
      const hasInstagramEng = p.platforms?.some((plat: any) =>
        plat.platform === 'instagram' && ((plat.analytics?.likes || 0) + (plat.analytics?.comments || 0)) > 0
      );
      return hasYoutubeViews || hasInstagramEng;
    });

    console.log(`\n🏆 TOP 5 PERFORMERS FOR ${brandName.toUpperCase()}:\n`);

    // Sort by total performance (views + engagement)
    postsWithData
      .sort((a, b) => {
        const aScore = (a.analytics?.views || 0) +
          ((a.analytics?.likes || 0) + (a.analytics?.comments || 0)) * 10;
        const bScore = (b.analytics?.views || 0) +
          ((b.analytics?.likes || 0) + (b.analytics?.comments || 0)) * 10;
        return bScore - aScore;
      })
      .slice(0, 5)
      .forEach((post, idx) => {
        const ytViews = post.platforms?.find((p: any) => p.platform === 'youtube')?.analytics?.views || 0;
        const igLikes = post.platforms?.find((p: any) => p.platform === 'instagram')?.analytics?.likes || 0;
        const igComments = post.platforms?.find((p: any) => p.platform === 'instagram')?.analytics?.comments || 0;

        console.log(`${idx + 1}. ${(post.content || '').substring(0, 70)}...`);
        if (ytViews > 0) console.log(`   YouTube: ${ytViews} views`);
        if (igLikes > 0 || igComments > 0) console.log(`   Instagram: ${igLikes} likes, ${igComments} comments`);
        console.log(`   Published: ${post.publishedAt || 'N/A'}\n`);
      });

    // Caption patterns
    console.log(`\n📝 CAPTION PATTERNS FOR ${brandName.toUpperCase()}:\n`);

    const top10 = postsWithData.slice(0, 10);
    const patterns = {
      'Has Emoji': 0,
      'Has Question': 0,
      'Has Exclamation': 0,
      '<100 chars': 0,
      '100-200 chars': 0,
      '>200 chars': 0,
    };

    top10.forEach(post => {
      const caption = post.content || '';
      if (/[\u{1F300}-\u{1F9FF}]/u.test(caption)) patterns['Has Emoji']++;
      if (caption.includes('?')) patterns['Has Question']++;
      if (caption.includes('!')) patterns['Has Exclamation']++;
      if (caption.length < 100) patterns['<100 chars']++;
      else if (caption.length < 200) patterns['100-200 chars']++;
      else patterns['>200 chars']++;
    });

    Object.entries(patterns).forEach(([pattern, count]) => {
      if (count > 0) {
        const percentage = ((count / top10.length) * 100).toFixed(0);
        console.log(`   ${pattern.padEnd(20)} | ${count}/${top10.length} (${percentage}%)`);
      }
    });

    // Timing analysis
    console.log(`\n⏰ BEST POSTING TIMES FOR ${brandName.toUpperCase()}:\n`);

    const hourPerformance = new Map<number, number>();
    const dayPerformance = new Map<string, number>();

    postsWithData.forEach(post => {
      if (post.publishedAt) {
        const date = new Date(post.publishedAt);
        const hour = date.getHours();
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

        const score = (post.analytics?.views || 0) +
          ((post.analytics?.likes || 0) + (post.analytics?.comments || 0)) * 10;

        hourPerformance.set(hour, (hourPerformance.get(hour) || 0) + score);
        dayPerformance.set(day, (dayPerformance.get(day) || 0) + score);
      }
    });

    console.log('Best Hours:');
    Array.from(hourPerformance.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([hour, score]) => {
        console.log(`   ${hour.toString().padStart(2, '0')}:00 - score: ${Math.round(score)}`);
      });

    console.log('\nBest Days:');
    Array.from(dayPerformance.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([day, score]) => {
        console.log(`   ${day} - score: ${Math.round(score)}`);
      });

    // RECOMMENDATIONS
    console.log(`\n\n🎯 ACTIONABLE RECOMMENDATIONS FOR ${brandName.toUpperCase()}:\n`);

    const bestPlatform = Object.entries(platformStats)
      .sort((a, b) => {
        const aScore = (a[1].views || 0) + ((a[1] as any).engagement || 0) * 10;
        const bScore = (b[1].views || 0) + ((b[1] as any).engagement || 0) * 10;
        return bScore - aScore;
      })[0];

    const topCaptionPattern = Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])[0];

    const bestHour = Array.from(hourPerformance.entries())
      .sort((a, b) => b[1] - a[1])[0];

    const bestDay = Array.from(dayPerformance.entries())
      .sort((a, b) => b[1] - a[1])[0];

    console.log(`📌 DECISION #1: Platform Focus`);
    console.log(`   "${brandName} should prioritize ${bestPlatform[0]}"`);

    console.log(`\n📌 DECISION #2: Caption Style`);
    console.log(`   "${brandName} captions should be ${topCaptionPattern[0]} (${((topCaptionPattern[1] / top10.length) * 100).toFixed(0)}% of top posts)"`);

    console.log(`\n📌 DECISION #3: Posting Schedule`);
    if (bestHour && bestDay) {
      console.log(`   "${brandName} posts should go live at ${bestHour[0]}:00 on ${bestDay[0]}s"`);
    }

    console.log('\n');
  }

  console.log('═'.repeat(100));
  console.log('\n✅ ANALYSIS COMPLETE\n');
  console.log('═'.repeat(100));
}

brandSpecificAnalysis().catch(console.error);
