#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function brandContentPatternAnalysis() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('🔍 BRAND CONTENT PATTERN ANALYSIS\n');
  console.log('What makes each brand\'s TOP content succeed?\n');
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
  // CLASSIFY BY BRAND
  // ============================================================================

  const brandPosts = {
    carz: [] as any[],
    ownerfi: [] as any[],
    podcast: [] as any[],
    other: [] as any[],
  };

  allPosts.forEach(post => {
    const content = (post.content || '').toLowerCase();

    if (
      content.includes('car') ||
      content.includes('vehicle') ||
      content.includes('ev') ||
      content.includes('electric') ||
      content.includes('tesla') ||
      content.includes('cadillac') ||
      content.includes('dealer') ||
      content.includes('wholesale') ||
      content.includes('nissan') ||
      content.includes('bmw') ||
      content.includes('audi')
    ) {
      brandPosts.carz.push(post);
    } else if (
      content.includes('home') ||
      content.includes('house') ||
      content.includes('owner financ') ||
      content.includes('real estate') ||
      content.includes('mortgage') ||
      content.includes('rent') ||
      content.includes('credit score') ||
      content.includes('homeowner')
    ) {
      brandPosts.ownerfi.push(post);
    } else if (
      content.includes('on ') && (
        content.includes('dr.') ||
        content.includes('coach') ||
        content.includes('expert') ||
        content.match(/\w+ \w+ on \w+/)
      )
    ) {
      brandPosts.podcast.push(post);
    } else {
      brandPosts.other.push(post);
    }
  });

  // ============================================================================
  // ANALYZE EACH BRAND'S TOP PERFORMERS
  // ============================================================================

  for (const [brandName, posts] of Object.entries(brandPosts)) {
    if (posts.length === 0 || brandName === 'other') continue;

    console.log('\n' + '═'.repeat(100));
    console.log(`\n🏢 ${brandName.toUpperCase()} - WHAT WORKS BEST?\n`);
    console.log('═'.repeat(100));

    // Calculate performance score for each post across ALL platforms
    const scoredPosts = posts.map(post => {
      let youtubeViews = 0;
      let instagramEngagement = 0;
      let tiktokEngagement = 0;
      let facebookEngagement = 0;

      if (post.platforms) {
        post.platforms.forEach((p: any) => {
          const analytics = p.analytics || {};

          if (p.platform === 'youtube') {
            youtubeViews = analytics.views || 0;
          } else if (p.platform === 'instagram') {
            instagramEngagement = (analytics.likes || 0) + (analytics.comments || 0);
          } else if (p.platform === 'tiktok') {
            tiktokEngagement = (analytics.likes || 0) + (analytics.comments || 0);
          } else if (p.platform === 'facebook') {
            facebookEngagement = (analytics.likes || 0) + (analytics.comments || 0);
          }
        });
      }

      // Total score = views + (engagement * 10 to weight it)
      const totalScore = youtubeViews + (instagramEngagement * 10) + (tiktokEngagement * 10) + (facebookEngagement * 10);

      return {
        content: post.content || '',
        youtubeViews,
        instagramEngagement,
        tiktokEngagement,
        facebookEngagement,
        totalScore,
        publishedAt: post.publishedAt,
        platforms: post.platforms
      };
    }).filter(p => p.totalScore > 0); // Only posts with SOME performance

    // Sort by total score
    scoredPosts.sort((a, b) => b.totalScore - a.totalScore);

    console.log(`\nTotal ${brandName} posts with data: ${scoredPosts.length}\n`);

    // ============================================================================
    // TOP 10 POSTS - WHAT DO THEY HAVE IN COMMON?
    // ============================================================================

    console.log(`🏆 TOP 10 PERFORMING ${brandName.toUpperCase()} POSTS:\n`);

    const top10 = scoredPosts.slice(0, 10);

    top10.forEach((post, idx) => {
      console.log(`${idx + 1}. Score: ${post.totalScore}`);
      console.log(`   YT Views: ${post.youtubeViews} | IG: ${post.instagramEngagement} | TT: ${post.tiktokEngagement} | FB: ${post.facebookEngagement}`);
      console.log(`   Caption: "${post.content.substring(0, 100)}..."`);
      console.log(`   Published: ${post.publishedAt || 'N/A'}\n`);
    });

    // ============================================================================
    // CONTENT PATTERN ANALYSIS
    // ============================================================================

    console.log(`\n📝 CONTENT PATTERNS IN TOP 20 ${brandName.toUpperCase()} POSTS:\n`);

    const top20 = scoredPosts.slice(0, 20);

    const patterns = {
      'Has Emoji': 0,
      'Has Question': 0,
      'Has Exclamation': 0,
      'Has Numbers/Stats': 0,
      'Mentions Price/Money': 0,
      'Mentions Credit': 0,
      'Short (<100 chars)': 0,
      'Medium (100-200 chars)': 0,
      'Long (>200 chars)': 0,
    };

    // Brand-specific patterns
    const carzPatterns = {
      'Mentions EV/Electric': 0,
      'Mentions Specific Car Brand': 0,
      'Mentions Dealer/Wholesale': 0,
      'Controversial/Shocking': 0,
    };

    const ownerfiPatterns = {
      'Mentions Owner Financing': 0,
      'Mentions Bad Credit': 0,
      'Mentions Renting': 0,
      'Pain Point Question': 0,
    };

    top20.forEach(post => {
      const caption = post.content || '';

      // General patterns
      if (/[\u{1F300}-\u{1F9FF}]/u.test(caption)) patterns['Has Emoji']++;
      if (caption.includes('?')) patterns['Has Question']++;
      if (caption.includes('!')) patterns['Has Exclamation']++;
      if (/\d+/.test(caption)) patterns['Has Numbers/Stats']++;
      if (/\$|price|cost|money|save|savings/i.test(caption)) patterns['Mentions Price/Money']++;
      if (/credit/i.test(caption)) patterns['Mentions Credit']++;

      if (caption.length < 100) patterns['Short (<100 chars)']++;
      else if (caption.length < 200) patterns['Medium (100-200 chars)']++;
      else patterns['Long (>200 chars)']++;

      // Carz-specific
      if (brandName === 'carz') {
        if (/ev|electric/i.test(caption)) carzPatterns['Mentions EV/Electric']++;
        if (/tesla|nissan|bmw|audi|cadillac|ford|gm/i.test(caption)) carzPatterns['Mentions Specific Car Brand']++;
        if (/dealer|wholesale/i.test(caption)) carzPatterns['Mentions Dealer/Wholesale']++;
        if (/shock|surprise|secret|exposed|truth|don't want you to know/i.test(caption)) carzPatterns['Controversial/Shocking']++;
      }

      // OwnerFi-specific
      if (brandName === 'ownerfi') {
        if (/owner financ/i.test(caption)) ownerfiPatterns['Mentions Owner Financing']++;
        if (/bad credit|poor credit|no credit|credit score/i.test(caption)) ownerfiPatterns['Mentions Bad Credit']++;
        if (/rent|renting|tenant/i.test(caption)) ownerfiPatterns['Mentions Renting']++;
        if (/^(are you|do you|have you|can you|stuck|tired|trapped|worried)/i.test(caption)) ownerfiPatterns['Pain Point Question']++;
      }
    });

    console.log('GENERAL PATTERNS:');
    Object.entries(patterns).forEach(([pattern, count]) => {
      const percentage = ((count / 20) * 100).toFixed(0);
      console.log(`   ${pattern.padEnd(30)} | ${count}/20 (${percentage}%)`);
    });

    if (brandName === 'carz') {
      console.log('\nCARZ-SPECIFIC PATTERNS:');
      Object.entries(carzPatterns).forEach(([pattern, count]) => {
        const percentage = ((count / 20) * 100).toFixed(0);
        console.log(`   ${pattern.padEnd(30)} | ${count}/20 (${percentage}%)`);
      });
    }

    if (brandName === 'ownerfi') {
      console.log('\nOWNERFI-SPECIFIC PATTERNS:');
      Object.entries(ownerfiPatterns).forEach(([pattern, count]) => {
        const percentage = ((count / 20) * 100).toFixed(0);
        console.log(`   ${pattern.padEnd(30)} | ${count}/20 (${percentage}%)`);
      });
    }

    // ============================================================================
    // PLATFORM BREAKDOWN FOR TOP POSTS
    // ============================================================================

    console.log(`\n\n📊 WHERE DOES ${brandName.toUpperCase()}'S TOP CONTENT PERFORM?\n`);

    const platformPerformance = {
      youtube: { posts: 0, totalViews: 0, avgViews: 0 },
      instagram: { posts: 0, totalEngagement: 0, avgEngagement: 0 },
      tiktok: { posts: 0, totalEngagement: 0, avgEngagement: 0 },
      facebook: { posts: 0, totalEngagement: 0, avgEngagement: 0 },
    };

    top20.forEach(post => {
      if (post.youtubeViews > 0) {
        platformPerformance.youtube.posts++;
        platformPerformance.youtube.totalViews += post.youtubeViews;
      }
      if (post.instagramEngagement > 0) {
        platformPerformance.instagram.posts++;
        platformPerformance.instagram.totalEngagement += post.instagramEngagement;
      }
      if (post.tiktokEngagement > 0) {
        platformPerformance.tiktok.posts++;
        platformPerformance.tiktok.totalEngagement += post.tiktokEngagement;
      }
      if (post.facebookEngagement > 0) {
        platformPerformance.facebook.posts++;
        platformPerformance.facebook.totalEngagement += post.facebookEngagement;
      }
    });

    // Calculate averages
    if (platformPerformance.youtube.posts > 0) {
      platformPerformance.youtube.avgViews = Math.round(
        platformPerformance.youtube.totalViews / platformPerformance.youtube.posts
      );
    }
    if (platformPerformance.instagram.posts > 0) {
      platformPerformance.instagram.avgEngagement = (
        platformPerformance.instagram.totalEngagement / platformPerformance.instagram.posts
      ).toFixed(1);
    }

    console.log(`Top 20 ${brandName} posts platform breakdown:`);
    console.log(`\nYouTube:`);
    console.log(`   Posts with views: ${platformPerformance.youtube.posts}/20`);
    console.log(`   Total views: ${platformPerformance.youtube.totalViews.toLocaleString()}`);
    console.log(`   Avg per post: ${platformPerformance.youtube.avgViews}`);

    console.log(`\nInstagram:`);
    console.log(`   Posts with engagement: ${platformPerformance.instagram.posts}/20`);
    console.log(`   Total engagement: ${platformPerformance.instagram.totalEngagement}`);
    console.log(`   Avg per post: ${platformPerformance.instagram.avgEngagement}`);

    console.log(`\nTikTok:`);
    console.log(`   Posts with engagement: ${platformPerformance.tiktok.posts}/20`);
    console.log(`   Total engagement: ${platformPerformance.tiktok.totalEngagement}`);

    console.log(`\nFacebook:`);
    console.log(`   Posts with engagement: ${platformPerformance.facebook.posts}/20`);
    console.log(`   Total engagement: ${platformPerformance.facebook.totalEngagement}`);

    // ============================================================================
    // TIMING FOR TOP POSTS
    // ============================================================================

    console.log(`\n\n⏰ WHEN DO ${brandName.toUpperCase()}'S TOP POSTS GO LIVE?\n`);

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

    console.log('Top 20 posts - Best posting hours:');
    Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([hour, count]) => {
        console.log(`   ${hour.toString().padStart(2, '0')}:00 - ${count} posts`);
      });

    console.log('\nTop 20 posts - Best posting days:');
    Array.from(dayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([day, count]) => {
        console.log(`   ${day} - ${count} posts`);
      });

    // ============================================================================
    // RECOMMENDATIONS
    // ============================================================================

    console.log(`\n\n🎯 ${brandName.toUpperCase()} CONTENT FORMULA:\n`);

    const topCaptionLength = Object.entries(patterns)
      .filter(([k]) => k.includes('chars'))
      .sort((a, b) => b[1] - a[1])[0];

    const topHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const topDay = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0];

    console.log(`Caption Length: ${topCaptionLength[0]} (${((topCaptionLength[1] / 20) * 100).toFixed(0)}% of top posts)`);
    console.log(`Has Question: ${patterns['Has Question']}/20 posts`);
    console.log(`Has Exclamation: ${patterns['Has Exclamation']}/20 posts`);
    console.log(`Has Emoji: ${patterns['Has Emoji']}/20 posts`);
    console.log(`Mentions Price/Money: ${patterns['Mentions Price/Money']}/20 posts`);

    if (brandName === 'carz') {
      console.log(`\nCarz-Specific:`);
      console.log(`   EV/Electric mentions: ${carzPatterns['Mentions EV/Electric']}/20`);
      console.log(`   Specific car brands: ${carzPatterns['Mentions Specific Car Brand']}/20`);
      console.log(`   Controversial angle: ${carzPatterns['Controversial/Shocking']}/20`);
    }

    if (brandName === 'ownerfi') {
      console.log(`\nOwnerFi-Specific:`);
      console.log(`   Bad credit mentions: ${ownerfiPatterns['Mentions Bad Credit']}/20`);
      console.log(`   Owner financing mentions: ${ownerfiPatterns['Mentions Owner Financing']}/20`);
      console.log(`   Pain point questions: ${ownerfiPatterns['Pain Point Question']}/20`);
    }

    if (topHour && topDay) {
      console.log(`\nBest posting time: ${topDay[0]}s at ${topHour[0]}:00`);
    }

    console.log(`\nTop platform: ${
      platformPerformance.youtube.totalViews > (platformPerformance.instagram.totalEngagement * 10)
        ? 'YouTube'
        : 'Instagram'
    }`);
  }

  console.log('\n' + '═'.repeat(100));
  console.log('\n✅ CONTENT PATTERN ANALYSIS COMPLETE\n');
  console.log('═'.repeat(100));
}

brandContentPatternAnalysis().catch(console.error);
