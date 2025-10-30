#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function engagementAnalysis() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('🎯 ENGAGEMENT-FOCUSED ANALYSIS\n');
  console.log('Instagram & TikTok = Engagement (likes + comments)');
  console.log('YouTube = Views\n');
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

  // ============================================================================
  // PLATFORM METRICS
  // ============================================================================
  console.log('\n📊 PLATFORM PERFORMANCE SUMMARY\n');

  const platformStats = {
    instagram: { posts: 0, likes: 0, comments: 0, engagement: 0, postsWithData: 0 },
    tiktok: { posts: 0, likes: 0, comments: 0, engagement: 0, postsWithData: 0 },
    youtube: { posts: 0, views: 0, likes: 0, comments: 0, postsWithData: 0 },
  };

  allPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        const platform = p.platform;
        const analytics = p.analytics || {};

        if (platform === 'instagram' || platform === 'tiktok' || platform === 'youtube') {
          const stats = platformStats[platform as keyof typeof platformStats];
          stats.posts++;

          const likes = analytics.likes || 0;
          const comments = analytics.comments || 0;
          const views = analytics.views || 0;

          stats.likes += likes;
          stats.comments += comments;
          stats.engagement += (likes + comments);

          if (platform === 'youtube') {
            stats.views += views;
          }

          if (likes > 0 || comments > 0 || views > 0) {
            stats.postsWithData++;
          }
        }
      });
    }
  });

  console.log('INSTAGRAM:');
  console.log(`   Total Posts: ${platformStats.instagram.posts}`);
  console.log(`   Posts with Engagement: ${platformStats.instagram.postsWithData} (${((platformStats.instagram.postsWithData / platformStats.instagram.posts) * 100).toFixed(1)}%)`);
  console.log(`   Total Likes: ${platformStats.instagram.likes}`);
  console.log(`   Total Comments: ${platformStats.instagram.comments}`);
  console.log(`   Total Engagement: ${platformStats.instagram.engagement}`);
  console.log(`   Avg Engagement per Post: ${(platformStats.instagram.engagement / platformStats.instagram.posts).toFixed(1)}`);

  console.log('\nTIKTOK:');
  console.log(`   Total Posts: ${platformStats.tiktok.posts}`);
  console.log(`   Posts with Engagement: ${platformStats.tiktok.postsWithData} (${((platformStats.tiktok.postsWithData / platformStats.tiktok.posts) * 100).toFixed(1)}%)`);
  console.log(`   Total Likes: ${platformStats.tiktok.likes}`);
  console.log(`   Total Comments: ${platformStats.tiktok.comments}`);
  console.log(`   Total Engagement: ${platformStats.tiktok.engagement}`);
  console.log(`   Avg Engagement per Post: ${(platformStats.tiktok.engagement / platformStats.tiktok.posts).toFixed(1)}`);

  console.log('\nYOUTUBE:');
  console.log(`   Total Posts: ${platformStats.youtube.posts}`);
  console.log(`   Posts with Views: ${platformStats.youtube.postsWithData} (${((platformStats.youtube.postsWithData / platformStats.youtube.posts) * 100).toFixed(1)}%)`);
  console.log(`   Total Views: ${platformStats.youtube.views.toLocaleString()}`);
  console.log(`   Avg Views per Post: ${Math.round(platformStats.youtube.views / platformStats.youtube.posts)}`);
  console.log(`   Total Likes: ${platformStats.youtube.likes}`);
  console.log(`   Total Comments: ${platformStats.youtube.comments}`);

  // ============================================================================
  // TOP PERFORMERS BY PLATFORM
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('🏆 TOP 10 PERFORMERS BY PLATFORM\n');

  // Instagram top posts by engagement
  const instagramPosts: any[] = [];
  allPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        if (p.platform === 'instagram') {
          const likes = p.analytics?.likes || 0;
          const comments = p.analytics?.comments || 0;
          if (likes > 0 || comments > 0) {
            instagramPosts.push({
              caption: (post.content || '').substring(0, 70),
              likes,
              comments,
              engagement: likes + comments,
              publishedAt: post.publishedAt,
            });
          }
        }
      });
    }
  });

  console.log('INSTAGRAM TOP 10 (by engagement):');
  instagramPosts
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10)
    .forEach((post, idx) => {
      console.log(`   ${idx + 1}. ${post.engagement} engagement (${post.likes} likes, ${post.comments} comments)`);
      console.log(`      "${post.caption}..."`);
      console.log(`      Posted: ${post.publishedAt || 'N/A'}\n`);
    });

  // TikTok top posts
  const tiktokPosts: any[] = [];
  allPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        if (p.platform === 'tiktok') {
          const likes = p.analytics?.likes || 0;
          const comments = p.analytics?.comments || 0;
          if (likes > 0 || comments > 0) {
            tiktokPosts.push({
              caption: (post.content || '').substring(0, 70),
              likes,
              comments,
              engagement: likes + comments,
              publishedAt: post.publishedAt,
            });
          }
        }
      });
    }
  });

  if (tiktokPosts.length > 0) {
    console.log('TIKTOK TOP 10 (by engagement):');
    tiktokPosts
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10)
      .forEach((post, idx) => {
        console.log(`   ${idx + 1}. ${post.engagement} engagement (${post.likes} likes, ${post.comments} comments)`);
        console.log(`      "${post.caption}..."`);
        console.log(`      Posted: ${post.publishedAt || 'N/A'}\n`);
      });
  } else {
    console.log('TIKTOK: No posts with engagement data\n');
  }

  // ============================================================================
  // CONTENT PATTERNS FOR HIGH ENGAGEMENT
  // ============================================================================
  console.log('═'.repeat(100));
  console.log('📝 WHAT DRIVES ENGAGEMENT ON INSTAGRAM?\n');

  const top20Instagram = instagramPosts
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 20);

  const patterns = {
    'Has Emoji': 0,
    'Has Question': 0,
    'Has Exclamation': 0,
    'Owner Financing': 0,
    'Real Estate': 0,
    'Cars/EV': 0,
    '>200 chars': 0,
    '<100 chars': 0,
  };

  top20Instagram.forEach(post => {
    const caption = post.caption || '';
    if (/[\u{1F300}-\u{1F9FF}]/u.test(caption)) patterns['Has Emoji']++;
    if (caption.includes('?')) patterns['Has Question']++;
    if (caption.includes('!')) patterns['Has Exclamation']++;
    if (/owner financ/i.test(caption)) patterns['Owner Financing']++;
    if (/real estate|home|house|mortgage/i.test(caption)) patterns['Real Estate']++;
    if (/car|ev|electric|vehicle/i.test(caption)) patterns['Cars/EV']++;
    if (caption.length > 200) patterns['>200 chars']++;
    if (caption.length < 100) patterns['<100 chars']++;
  });

  console.log('Top 20 Instagram posts common traits:');
  Object.entries(patterns).forEach(([pattern, count]) => {
    const percentage = ((count / 20) * 100).toFixed(0);
    console.log(`   ${pattern.padEnd(25)} | ${count}/20 (${percentage}%)`);
  });

  // ============================================================================
  // TIMING ANALYSIS
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('⏰ WHEN TO POST FOR MAX ENGAGEMENT\n');

  const instagramTiming = new Map<number, number>();
  const instagramDays = new Map<string, number>();

  instagramPosts.forEach(post => {
    if (post.publishedAt) {
      const date = new Date(post.publishedAt);
      const hour = date.getHours();
      const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      instagramTiming.set(hour, (instagramTiming.get(hour) || 0) + post.engagement);
      instagramDays.set(day, (instagramDays.get(day) || 0) + post.engagement);
    }
  });

  console.log('INSTAGRAM - Best Hours (by total engagement):');
  Array.from(instagramTiming.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([hour, engagement]) => {
      console.log(`   ${hour.toString().padStart(2, '0')}:00 - ${engagement} total engagement`);
    });

  console.log('\nINSTAGRAM - Best Days (by total engagement):');
  Array.from(instagramDays.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([day, engagement]) => {
      console.log(`   ${day} - ${engagement} total engagement`);
    });

  // ============================================================================
  // ACTIONABLE DECISIONS
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('🎯 COPY-PASTE DECISION PROMPTS\n');
  console.log('═'.repeat(100));

  const instagramSuccess = ((platformStats.instagram.postsWithData / platformStats.instagram.posts) * 100).toFixed(1);
  const tiktokSuccess = ((platformStats.tiktok.postsWithData / platformStats.tiktok.posts) * 100).toFixed(1);
  const youtubeSuccess = ((platformStats.youtube.postsWithData / platformStats.youtube.posts) * 100).toFixed(1);

  console.log(`\n📌 DECISION #1: Platform Mix Strategy`);
  console.log(`   Instagram: ${platformStats.instagram.postsWithData}/${platformStats.instagram.posts} posts have engagement (${instagramSuccess}%)`);
  console.log(`   TikTok: ${platformStats.tiktok.postsWithData}/${platformStats.tiktok.posts} posts have engagement (${tiktokSuccess}%)`);
  console.log(`   YouTube: ${platformStats.youtube.postsWithData}/${platformStats.youtube.posts} posts have views (${youtubeSuccess}%)`);
  console.log(`\n   Recommendation:`);
  console.log(`   "Keep all 3 platforms active. Instagram has ${instagramSuccess}% engagement rate with ${platformStats.instagram.engagement} total engagement."`);

  console.log(`\n📌 DECISION #2: Content Formula for Instagram`);
  console.log(`   Top patterns in high-engagement posts:`);
  const topPattern = Object.entries(patterns).sort((a, b) => b[1] - a[1])[0];
  console.log(`   - Most common: ${topPattern[0]} (${topPattern[1]}/20 posts)`);
  console.log(`\n   Recommendation:`);
  console.log(`   "For Instagram, focus on ${topPattern[0]} in captions - appears in ${((topPattern[1] / 20) * 100).toFixed(0)}% of top posts"`);

  const bestHour = Array.from(instagramTiming.entries()).sort((a, b) => b[1] - a[1])[0];
  const bestDay = Array.from(instagramDays.entries()).sort((a, b) => b[1] - a[1])[0];

  console.log(`\n📌 DECISION #3: Instagram Posting Schedule`);
  console.log(`   Best hour: ${bestHour[0]}:00 (${bestHour[1]} total engagement)`);
  console.log(`   Best day: ${bestDay[0]} (${bestDay[1]} total engagement)`);
  console.log(`\n   Recommendation:`);
  console.log(`   "Schedule Instagram posts at ${bestHour[0]}:00 on ${bestDay[0]}s"`);

  console.log(`\n📌 DECISION #4: Content Topic Priority`);
  const topTopics = [
    { name: 'Real Estate', count: patterns['Real Estate'] },
    { name: 'Owner Financing', count: patterns['Owner Financing'] },
    { name: 'Cars/EV', count: patterns['Cars/EV'] },
  ].sort((a, b) => b.count - a.count);

  console.log(`   Topics in top 20 Instagram posts:`);
  topTopics.forEach(topic => {
    console.log(`   - ${topic.name}: ${topic.count}/20 posts (${((topic.count / 20) * 100).toFixed(0)}%)`);
  });
  console.log(`\n   Recommendation:`);
  console.log(`   "Prioritize ${topTopics[0].name} content for Instagram - appears in ${topTopics[0].count}/20 top posts"`);

  // Platform comparison
  console.log(`\n📌 DECISION #5: Resource Allocation`);
  console.log(`   Total Engagement by Platform:`);
  console.log(`   - Instagram: ${platformStats.instagram.engagement} (avg ${(platformStats.instagram.engagement / platformStats.instagram.posts).toFixed(1)} per post)`);
  console.log(`   - TikTok: ${platformStats.tiktok.engagement} (avg ${(platformStats.tiktok.engagement / platformStats.tiktok.posts).toFixed(1)} per post)`);
  console.log(`   - YouTube: ${platformStats.youtube.views.toLocaleString()} views (avg ${Math.round(platformStats.youtube.views / platformStats.youtube.posts)} per post)`);
  console.log(`\n   Recommendation:`);
  console.log(`   "Maintain current platform mix: YouTube for reach (17k views), Instagram for engagement (${platformStats.instagram.engagement} interactions)"`);

  console.log('\n' + '═'.repeat(100));
}

engagementAnalysis().catch(console.error);
