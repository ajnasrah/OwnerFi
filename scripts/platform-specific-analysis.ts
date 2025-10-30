#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function platformSpecificAnalysis() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('📱 PLATFORM-SPECIFIC CONTENT ANALYSIS\n');
  console.log('What does each platform\'s audience want?\n');
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
  // ORGANIZE BY PLATFORM
  // ============================================================================

  const platformPosts = {
    youtube: [] as any[],
    instagram: [] as any[],
    tiktok: [] as any[],
    facebook: [] as any[],
  };

  allPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        const platform = p.platform;
        const analytics = p.analytics || {};

        if (platform === 'youtube' || platform === 'instagram' || platform === 'tiktok' || platform === 'facebook') {
          const performanceScore = platform === 'youtube'
            ? (analytics.views || 0)
            : ((analytics.likes || 0) + (analytics.comments || 0));

          platformPosts[platform].push({
            content: post.content || '',
            caption: post.content || '',
            views: analytics.views || 0,
            likes: analytics.likes || 0,
            comments: analytics.comments || 0,
            engagement: (analytics.likes || 0) + (analytics.comments || 0),
            performanceScore,
            publishedAt: post.publishedAt,
          });
        }
      });
    }
  });

  // ============================================================================
  // ANALYZE EACH PLATFORM
  // ============================================================================

  for (const [platformName, posts] of Object.entries(platformPosts)) {
    if (posts.length === 0) continue;

    console.log('\n' + '═'.repeat(100));
    console.log(`\n📱 ${platformName.toUpperCase()} - WHAT DOES THIS PLATFORM WANT?\n`);
    console.log('═'.repeat(100));

    // Filter to posts with performance
    const performingPosts = posts.filter(p => p.performanceScore > 0);

    console.log(`Total ${platformName} posts: ${posts.length}`);
    console.log(`Posts with performance: ${performingPosts.length} (${((performingPosts.length / posts.length) * 100).toFixed(1)}%)\n`);

    if (performingPosts.length === 0) {
      console.log(`No performing posts on ${platformName} yet.\n`);
      continue;
    }

    // Sort by performance
    performingPosts.sort((a, b) => b.performanceScore - a.performanceScore);

    // ============================================================================
    // TOP PERFORMERS
    // ============================================================================

    console.log(`🏆 TOP 10 PERFORMING ${platformName.toUpperCase()} POSTS:\n`);

    const top10 = performingPosts.slice(0, 10);

    top10.forEach((post, idx) => {
      console.log(`${idx + 1}. Performance: ${post.performanceScore}`);
      if (platformName === 'youtube') {
        console.log(`   Views: ${post.views} | Likes: ${post.likes} | Comments: ${post.comments}`);
      } else {
        console.log(`   Engagement: ${post.engagement} (${post.likes} likes, ${post.comments} comments)`);
      }
      console.log(`   Caption: "${post.caption.substring(0, 100)}..."`);
      console.log(`   Published: ${post.publishedAt || 'N/A'}\n`);
    });

    // ============================================================================
    // CONTENT PATTERN ANALYSIS
    // ============================================================================

    console.log(`\n📝 WHAT CONTENT WORKS ON ${platformName.toUpperCase()}?\n`);

    const top20 = performingPosts.slice(0, 20);

    const patterns = {
      // Style patterns
      'Has Emoji': 0,
      'Has Question': 0,
      'Has Exclamation': 0,
      'Has Multiple Exclamations': 0,
      'Has Hashtags': 0,

      // Length patterns
      'Very Short (<50 chars)': 0,
      'Short (50-100 chars)': 0,
      'Medium (100-200 chars)': 0,
      'Long (200-300 chars)': 0,
      'Very Long (>300 chars)': 0,

      // Content patterns
      'Has Numbers/Stats': 0,
      'Mentions Price/Money': 0,
      'Mentions Credit/Financing': 0,
      'Educational/How-to': 0,
      'News/Announcement': 0,
      'Personal Story': 0,
      'Controversial/Shocking': 0,

      // Topic patterns
      'About Cars/EVs': 0,
      'About Real Estate': 0,
      'About Specific Brand': 0,
      'Pain Point Question': 0,
    };

    top20.forEach(post => {
      const caption = post.caption || '';
      const lower = caption.toLowerCase();

      // Style
      if (/[\u{1F300}-\u{1F9FF}]/u.test(caption)) patterns['Has Emoji']++;
      if (caption.includes('?')) patterns['Has Question']++;
      if (caption.includes('!')) patterns['Has Exclamation']++;
      if ((caption.match(/!/g) || []).length >= 2) patterns['Has Multiple Exclamations']++;
      if (caption.includes('#')) patterns['Has Hashtags']++;

      // Length
      if (caption.length < 50) patterns['Very Short (<50 chars)']++;
      else if (caption.length < 100) patterns['Short (50-100 chars)']++;
      else if (caption.length < 200) patterns['Medium (100-200 chars)']++;
      else if (caption.length < 300) patterns['Long (200-300 chars)']++;
      else patterns['Very Long (>300 chars)']++;

      // Content type
      if (/\d+/.test(caption)) patterns['Has Numbers/Stats']++;
      if (/\$|price|cost|money|save|savings|afford/i.test(caption)) patterns['Mentions Price/Money']++;
      if (/credit|financ|loan|mortgage|bank/i.test(caption)) patterns['Mentions Credit/Financing']++;
      if (/how to|learn|guide|tip|step|way to|process/i.test(lower)) patterns['Educational/How-to']++;
      if (/new|announce|launch|release|just|breaking|alert/i.test(lower)) patterns['News/Announcement']++;
      if (/i |my |me |bought|got|achieved/i.test(lower)) patterns['Personal Story']++;
      if (/shock|surprise|secret|exposed|truth|don't want you|hide|reveal/i.test(lower)) patterns['Controversial/Shocking']++;

      // Topics
      if (/car|vehicle|ev|electric|tesla|dealer|drive/i.test(lower)) patterns['About Cars/EVs']++;
      if (/home|house|real estate|rent|property|homeowner/i.test(lower)) patterns['About Real Estate']++;
      if (/tesla|nissan|bmw|cadillac|ford|kia|toyota/i.test(lower)) patterns['About Specific Brand']++;
      if (/^(are you|do you|have you|can you|stuck|tired|trapped|worried|ready|waiting)/i.test(caption)) patterns['Pain Point Question']++;
    });

    console.log('CONTENT PATTERNS (Top 20 posts):');
    Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pattern, count]) => {
        if (count > 0) {
          const percentage = ((count / 20) * 100).toFixed(0);
          console.log(`   ${pattern.padEnd(35)} | ${count}/20 (${percentage}%)`);
        }
      });

    // ============================================================================
    // AVERAGE CAPTION LENGTH
    // ============================================================================

    const avgLength = Math.round(
      top20.reduce((sum, p) => sum + p.caption.length, 0) / top20.length
    );

    console.log(`\n📏 AVERAGE CAPTION LENGTH: ${avgLength} characters\n`);

    // ============================================================================
    // TIMING ANALYSIS
    // ============================================================================

    console.log(`⏰ BEST POSTING TIMES ON ${platformName.toUpperCase()}:\n`);

    const hourCounts = new Map<number, number>();
    const dayCounts = new Map<string, number>();

    top20.forEach(post => {
      if (post.publishedAt) {
        const date = new Date(post.publishedAt);
        const hour = date.getHours();
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
      }
    });

    console.log('Best Hours:');
    Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([hour, count]) => {
        console.log(`   ${hour.toString().padStart(2, '0')}:00 - ${count} top posts`);
      });

    console.log('\nBest Days:');
    Array.from(dayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([day, count]) => {
        console.log(`   ${day} - ${count} top posts`);
      });

    // ============================================================================
    // PLATFORM-SPECIFIC INSIGHTS
    // ============================================================================

    console.log(`\n\n🎯 ${platformName.toUpperCase()} AUDIENCE PREFERENCES:\n`);

    // Find top patterns
    const topLength = Object.entries(patterns)
      .filter(([k]) => k.includes('chars'))
      .sort((a, b) => b[1] - a[1])[0];

    const topContentType = Object.entries(patterns)
      .filter(([k]) => ['Educational/How-to', 'News/Announcement', 'Personal Story', 'Controversial/Shocking'].includes(k))
      .sort((a, b) => b[1] - a[1])[0];

    const topTopic = Object.entries(patterns)
      .filter(([k]) => k.startsWith('About'))
      .sort((a, b) => b[1] - a[1])[0];

    console.log(`Preferred Caption Length: ${topLength[0]} (${((topLength[1] / 20) * 100).toFixed(0)}% of top posts)`);
    console.log(`Preferred Content Type: ${topContentType[0]} (${((topContentType[1] / 20) * 100).toFixed(0)}% of top posts)`);
    console.log(`Preferred Topic: ${topTopic[0]} (${((topTopic[1] / 20) * 100).toFixed(0)}% of top posts)`);

    console.log(`\nStyle Elements:`);
    console.log(`   Emoji: ${patterns['Has Emoji']}/20 (${((patterns['Has Emoji'] / 20) * 100).toFixed(0)}%)`);
    console.log(`   Questions: ${patterns['Has Question']}/20 (${((patterns['Has Question'] / 20) * 100).toFixed(0)}%)`);
    console.log(`   Exclamations: ${patterns['Has Exclamation']}/20 (${((patterns['Has Exclamation'] / 20) * 100).toFixed(0)}%)`);
    console.log(`   Hashtags: ${patterns['Has Hashtags']}/20 (${((patterns['Has Hashtags'] / 20) * 100).toFixed(0)}%)`);
  }

  // ============================================================================
  // CROSS-PLATFORM COMPARISON
  // ============================================================================

  console.log('\n' + '═'.repeat(100));
  console.log('\n📊 CROSS-PLATFORM COMPARISON\n');
  console.log('═'.repeat(100));

  console.log('\nPlatform Success Rates:');
  for (const [platformName, posts] of Object.entries(platformPosts)) {
    if (posts.length === 0) continue;
    const performingPosts = posts.filter(p => p.performanceScore > 0);
    const successRate = ((performingPosts.length / posts.length) * 100).toFixed(1);
    const avgPerformance = performingPosts.length > 0
      ? Math.round(performingPosts.reduce((sum, p) => sum + p.performanceScore, 0) / performingPosts.length)
      : 0;

    console.log(`\n${platformName.toUpperCase()}:`);
    console.log(`   Success Rate: ${successRate}% (${performingPosts.length}/${posts.length} posts)`);
    console.log(`   Avg Performance: ${avgPerformance} ${platformName === 'youtube' ? 'views' : 'engagement'}`);
  }

  console.log('\n' + '═'.repeat(100));
  console.log('\n✅ PLATFORM ANALYSIS COMPLETE\n');
  console.log('═'.repeat(100));
}

platformSpecificAnalysis().catch(console.error);
