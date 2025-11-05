#!/usr/bin/env tsx
/**
 * Count how many pieces of content are being generated for each brand
 * Look at actual workflow completions and post creation rate
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function getContentGenerationRate(brand: string) {
  // Get analytics data for last 30 days
  const response = await fetch(`http://localhost:3000/api/analytics/platforms?brand=${brand}&days=30`);
  const data = await response.json();

  if (!data.success || !data.data.optimizationInsights) {
    return null;
  }

  const insights = data.data.optimizationInsights;

  // Calculate total posts across all platforms
  const totalPosts = insights.reduce((sum: number, i: any) => sum + i.totalPosts, 0);
  const postsPerDay = totalPosts / 30;

  return {
    brand,
    totalPostsLast30Days: totalPosts,
    avgPostsPerDay: postsPerDay,
    platforms: insights.map((i: any) => ({
      platform: i.platform,
      posts: i.totalPosts,
      postsPerDay: (i.totalPosts / 30).toFixed(1)
    }))
  };
}

async function main() {
  console.log('═'.repeat(100));
  console.log('📊 ACTUAL CONTENT GENERATION RATE BY BRAND');
  console.log('═'.repeat(100));
  console.log('\nAnalyzing last 30 days of posts to determine actual content production capacity...\n');

  const brands = ['carz', 'podcast', 'abdullah'];
  const results = [];

  for (const brand of brands) {
    const data = await getContentGenerationRate(brand);
    if (data) {
      results.push(data);
    }
  }

  // Display results
  results.forEach(r => {
    console.log('═'.repeat(100));
    console.log(`📱 ${r.brand.toUpperCase()}`);
    console.log('═'.repeat(100));
    console.log(`\n📈 CONTENT PRODUCTION RATE:\n`);
    console.log(`   Total posts (last 30 days): ${r.totalPostsLast30Days}`);
    console.log(`   Average per day: ${r.avgPostsPerDay.toFixed(1)} posts/day`);
    console.log(`   \n   Breakdown by platform:`);

    r.platforms.forEach((p: any) => {
      console.log(`      ${p.platform.padEnd(12)}: ${p.posts.toString().padStart(3)} posts/month (${p.postsPerDay} posts/day)`);
    });

    console.log(`\n   🎯 RECOMMENDATION:`);
    const rounded = Math.ceil(r.avgPostsPerDay);
    console.log(`      Set up ${rounded} queue slots per day (${rounded * 30} posts/month)`);
    console.log(`      Current capacity supports this frequency`);
    console.log('');
  });

  console.log('═'.repeat(100));
  console.log('💡 SUMMARY');
  console.log('═'.repeat(100));
  console.log(`\nBased on actual content generation over the last 30 days:\n`);

  results.forEach(r => {
    const slots = Math.ceil(r.avgPostsPerDay);
    console.log(`   ${r.brand.toUpperCase()}: Create ${slots} queue slots/day (currently producing ${r.avgPostsPerDay.toFixed(1)} posts/day)`);
  });

  console.log(`\n⚠️  IMPORTANT: Queue slots should match your content production rate`);
  console.log(`   If you have more slots than content, queue will run empty`);
  console.log(`   If you have less slots than content, posts won't get scheduled\n`);
}

main().catch(console.error);
