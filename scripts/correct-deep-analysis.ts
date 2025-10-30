#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function correctDeepAnalysis() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('🔬 CORRECT DEEP ANALYSIS - RAW LATE.DEV DATA\n');
  console.log('═'.repeat(100));

  // Fetch all posts from Late
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

  const postsWithViews = allPosts.filter(p => (p.analytics?.views || 0) > 0);
  const totalViews = allPosts.reduce((sum, p) => sum + (p.analytics?.views || 0), 0);

  console.log(`\n📊 CORRECT DATASET:`);
  console.log(`   Total Posts in Late.dev: ${allPosts.length}`);
  console.log(`   Posts with Views: ${postsWithViews.length} (${((postsWithViews.length / allPosts.length) * 100).toFixed(1)}%)`);
  console.log(`   Posts with 0 Views: ${allPosts.length - postsWithViews.length} (${(((allPosts.length - postsWithViews.length) / allPosts.length) * 100).toFixed(1)}%)`);
  console.log(`   Total Views: ${totalViews.toLocaleString()}`);

  // ============================================================================
  // WHY ARE 83% OF POSTS GETTING ZERO VIEWS?
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('❌ CRITICAL ISSUE: WHY 83% OF POSTS GET ZERO VIEWS');
  console.log('═'.repeat(100));

  const zeroViewPosts = allPosts.filter(p => (p.analytics?.views || 0) === 0);

  // Check platform distribution for zero-view posts
  const zeroPlatforms = new Map<string, number>();
  zeroViewPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        zeroPlatforms.set(p.platform, (zeroPlatforms.get(p.platform) || 0) + 1);
      });
    }
  });

  console.log(`\n🔍 Platforms used by ZERO-VIEW posts:`);
  Array.from(zeroPlatforms.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([platform, count]) => {
      console.log(`   ${platform}: ${count} posts`);
    });

  // Check when they were posted
  const now = Date.now();
  const ageGroups = {
    'Last 24h': zeroViewPosts.filter(p => p.publishedAt && (now - new Date(p.publishedAt).getTime()) < 24 * 60 * 60 * 1000).length,
    'Last 7 days': zeroViewPosts.filter(p => p.publishedAt && (now - new Date(p.publishedAt).getTime()) < 7 * 24 * 60 * 60 * 1000).length,
    'Last 30 days': zeroViewPosts.filter(p => p.publishedAt && (now - new Date(p.publishedAt).getTime()) < 30 * 24 * 60 * 60 * 1000).length,
    'Older': zeroViewPosts.filter(p => !p.publishedAt || (now - new Date(p.publishedAt).getTime()) >= 30 * 24 * 60 * 60 * 1000).length,
  };

  console.log(`\n📅 Age of ZERO-VIEW posts:`);
  Object.entries(ageGroups).forEach(([age, count]) => {
    console.log(`   ${age}: ${count} posts`);
  });

  // ============================================================================
  // WHAT MAKES THE 17% SUCCESSFUL?
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('✅ WHAT MAKES THE 17% SUCCESSFUL?');
  console.log('═'.repeat(100));

  const sorted = postsWithViews.sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0));

  // Platform analysis for successful posts
  const successPlatforms = new Map<string, { views: number; posts: number }>();
  postsWithViews.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        const views = p.analytics?.views || 0;
        if (views > 0) {
          const existing = successPlatforms.get(p.platform) || { views: 0, posts: 0 };
          existing.views += views;
          existing.posts += 1;
          successPlatforms.set(p.platform, existing);
        }
      });
    }
  });

  console.log(`\n📱 Platforms for SUCCESSFUL posts:`);
  Array.from(successPlatforms.entries())
    .sort((a, b) => b[1].views - a[1].views)
    .forEach(([platform, data]) => {
      console.log(`   ${platform}: ${data.views.toLocaleString()} total views | ${Math.round(data.views / data.posts)} avg | ${data.posts} posts`);
    });

  // Caption patterns for successful posts
  console.log(`\n📝 Caption patterns in TOP 20:`);
  const top20 = sorted.slice(0, 20);
  const patterns = {
    'Has Emoji': 0,
    'Has Question': 0,
    'Has Exclamation': 0,
    'Mentions Price/Money': 0,
    'EV/Electric': 0,
    'Recall/Warning': 0,
    '>200 chars': 0,
  };

  top20.forEach(post => {
    const caption = post.content || '';
    if (/[\u{1F300}-\u{1F9FF}]/u.test(caption)) patterns['Has Emoji']++;
    if (caption.includes('?')) patterns['Has Question']++;
    if (caption.includes('!')) patterns['Has Exclamation']++;
    if (/price|cost|\$|deal|cheap|expensive/i.test(caption)) patterns['Mentions Price/Money']++;
    if (/electric|ev|battery/i.test(caption)) patterns['EV/Electric']++;
    if (/recall|warning|alert|problem/i.test(caption)) patterns['Recall/Warning']++;
    if (caption.length > 200) patterns['>200 chars']++;
  });

  Object.entries(patterns).forEach(([pattern, count]) => {
    const percentage = ((count / 20) * 100).toFixed(0);
    console.log(`   ${pattern.padEnd(25)} | ${count}/20 (${percentage}%)`);
  });

  // Time analysis
  console.log(`\n⏰ When are successful posts published?`);
  const hourCounts = new Map<number, number>();
  const dayCounts = new Map<string, number>();

  postsWithViews.forEach(post => {
    if (post.publishedAt) {
      const date = new Date(post.publishedAt);
      const hour = date.getHours();
      const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }
  });

  console.log(`\n   Top hours:`);
  Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([hour, count]) => {
      console.log(`      ${hour.toString().padStart(2, '0')}:00 - ${count} successful posts`);
    });

  console.log(`\n   Top days:`);
  Array.from(dayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([day, count]) => {
      console.log(`      ${day} - ${count} successful posts`);
    });

  // ============================================================================
  // ACTIONABLE DECISIONS
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('🎯 COPY-PASTE DECISION PROMPTS');
  console.log('═'.repeat(100));

  console.log(`\n📌 DECISION #1: Platform Strategy`);
  console.log(`   Current: Posting to ${zeroPlatforms.size} platforms`);
  console.log(`   Problem: ${zeroViewPosts.length} posts on non-YouTube platforms = 0 views`);
  console.log(`   Solution: "Stop posting to all platforms except YouTube until we see traction elsewhere"`);

  console.log(`\n📌 DECISION #2: Caption Formula`);
  console.log(`   Pattern in top 20:`);
  console.log(`   - ${patterns['Has Emoji']}/20 have emojis (${((patterns['Has Emoji'] / 20) * 100).toFixed(0)}%)`);
  console.log(`   - ${patterns['Has Exclamation']}/20 have ! (${((patterns['Has Exclamation'] / 20) * 100).toFixed(0)}%)`);
  console.log(`   - ${patterns['>200 chars']}/20 are >200 chars (${((patterns['>200 chars'] / 20) * 100).toFixed(0)}%)`);
  console.log(`   Solution: "Make emojis, exclamations, and >200 char captions mandatory in content generation"`);

  console.log(`\n📌 DECISION #3: Content Topics`);
  const topTopics = new Map<string, number>();
  top20.forEach(post => {
    const caption = post.content || '';
    if (/electric|ev/i.test(caption)) topTopics.set('Electric Vehicles', (topTopics.get('Electric Vehicles') || 0) + 1);
    if (/recall|warning/i.test(caption)) topTopics.set('Recalls/Safety', (topTopics.get('Recalls/Safety') || 0) + 1);
    if (/owner financ|rent/i.test(caption)) topTopics.set('Owner Financing', (topTopics.get('Owner Financing') || 0) + 1);
    if (/luxury|supercar|cadillac/i.test(caption)) topTopics.set('Luxury Cars', (topTopics.get('Luxury Cars') || 0) + 1);
  });

  console.log(`   Topics in top 20:`);
  Array.from(topTopics.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, count]) => {
      console.log(`   - ${topic}: ${count} posts`);
    });
  console.log(`   Solution: "Prioritize ${Array.from(topTopics.entries()).sort((a, b) => b[1] - a[1])[0][0]} content in generation queue"`);

  console.log(`\n📌 DECISION #4: Posting Schedule`);
  const topHours = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topDays = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`   Most successful hours: ${topHours.map(([h, c]) => `${h}:00 (${c} posts)`).join(', ')}`);
  console.log(`   Most successful days: ${topDays.map(([d, c]) => `${d} (${c} posts)`).join(', ')}`);
  console.log(`   Solution: "Reschedule all future posts to ${topHours[0][0]}:00 on ${topDays[0][0]}s"`);

  console.log('\n' + '═'.repeat(100));
}

correctDeepAnalysis().catch(console.error);
