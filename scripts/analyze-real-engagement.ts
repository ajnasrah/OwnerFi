#!/usr/bin/env tsx
/**
 * Analyze Real Engagement Data
 *
 * Use reach, likes, comments, shares, saves instead of views
 * since Late API doesn't have access to view counts for some platforms
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const adminDb = await getAdminDb();
  if (!adminDb) throw new Error('Firebase not initialized');

  const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const snapshot = await (adminDb as any)
    .collection('platform_analytics')
    .where('lastUpdated', '>=', cutoffTime)
    .get();

  console.log('═'.repeat(100));
  console.log('📊 REAL ENGAGEMENT ANALYSIS - USING REACH, LIKES, COMMENTS, SHARES, SAVES');
  console.log('═'.repeat(100));
  console.log('');

  // Group by brand and platform
  const data: any = {};

  snapshot.forEach((doc: any) => {
    const d = doc.data();

    if (!data[d.brand]) data[d.brand] = {};
    if (!data[d.brand][d.platform]) {
      data[d.brand][d.platform] = {
        posts: [],
        totalReach: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaves: 0,
        totalViews: 0,
      };
    }

    const platform = data[d.brand][d.platform];
    platform.posts.push(d);
    platform.totalReach += (d.reach || 0);
    platform.totalLikes += (d.likes || 0);
    platform.totalComments += (d.comments || 0);
    platform.totalShares += (d.shares || 0);
    platform.totalSaves += (d.saves || 0);
    platform.totalViews += (d.views || 0);
  });

  // Analyze each brand
  const brands = ['carz', 'podcast', 'abdullah'];

  for (const brand of brands) {
    if (!data[brand]) continue;

    console.log(`\n${'━'.repeat(100)}`);
    console.log(`📱 ${brand.toUpperCase()}`);
    console.log(`${'━'.repeat(100)}\n`);

    const platforms = Object.entries(data[brand]).map(([platform, stats]: [string, any]) => {
      const postCount = stats.posts.length;
      const avgReach = stats.totalReach / postCount;
      const avgLikes = stats.totalLikes / postCount;
      const avgComments = stats.totalComments / postCount;
      const avgShares = stats.totalShares / postCount;
      const avgSaves = stats.totalSaves / postCount;
      const avgViews = stats.totalViews / postCount;

      // Engagement score = likes + comments + shares + saves
      const totalEngagement = stats.totalLikes + stats.totalComments + stats.totalShares + stats.totalSaves;
      const avgEngagement = totalEngagement / postCount;

      // Engagement rate based on reach (if available)
      const engagementRate = avgReach > 0 ? (avgEngagement / avgReach) * 100 : 0;

      return {
        platform,
        postCount,
        avgReach,
        avgLikes,
        avgComments,
        avgShares,
        avgSaves,
        avgViews,
        totalEngagement,
        avgEngagement,
        engagementRate,
      };
    }).sort((a, b) => {
      // Sort by reach first, then engagement
      if (b.avgReach !== a.avgReach) return b.avgReach - a.avgReach;
      return b.avgEngagement - a.avgEngagement;
    });

    // Display platform stats
    platforms.forEach((p, index) => {
      const icon = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';

      console.log(`${icon} ${p.platform.toUpperCase().padEnd(12)}`);
      console.log(`   Posts: ${p.postCount}`);
      console.log(`   Avg Reach: ${p.avgReach.toFixed(0)}`);
      console.log(`   Avg Engagement: ${p.avgEngagement.toFixed(2)} (${p.avgLikes.toFixed(1)} likes, ${p.avgComments.toFixed(1)} comments, ${p.avgShares.toFixed(1)} shares, ${p.avgSaves.toFixed(1)} saves)`);
      console.log(`   Engagement Rate: ${p.engagementRate.toFixed(2)}%`);
      console.log(`   Total Engagement: ${p.totalEngagement} interactions`);

      if (p.avgViews > 0) {
        console.log(`   Avg Views: ${p.avgViews.toFixed(0)} ✅ (API has view data)`);
      } else if (p.avgReach > 0) {
        console.log(`   Views: N/A (using reach: ${p.avgReach.toFixed(0)} as proxy)`);
      } else {
        console.log(`   ⚠️ No reach or view data available`);
      }
      console.log('');
    });

    // Recommendations
    console.log('🎯 RECOMMENDATIONS:\n');

    const topPlatform = platforms[0];
    if (topPlatform.avgReach > 0 || topPlatform.avgEngagement > 0) {
      console.log(`1. 🏆 FOCUS on ${topPlatform.platform.toUpperCase()}: ${topPlatform.avgReach.toFixed(0)} avg reach, ${topPlatform.avgEngagement.toFixed(2)} avg engagement`);
    }

    const highEngagement = platforms.filter(p => p.avgEngagement > 5);
    if (highEngagement.length > 0) {
      highEngagement.forEach(p => {
        console.log(`2. 📈 INCREASE ${p.platform.toUpperCase()}: Strong engagement (${p.avgEngagement.toFixed(2)} interactions/post)`);
      });
    }

    const lowEngagement = platforms.filter(p => p.avgReach > 0 && p.avgEngagement < 2);
    if (lowEngagement.length > 0) {
      lowEngagement.forEach(p => {
        console.log(`3. 📉 REDUCE ${p.platform.toUpperCase()}: Reach ${p.avgReach.toFixed(0)} but only ${p.avgEngagement.toFixed(2)} engagement/post`);
      });
    }

    const noData = platforms.filter(p => p.avgReach === 0 && p.avgEngagement === 0);
    if (noData.length > 0) {
      console.log(`4. ⚠️ INVESTIGATE: ${noData.map(p => p.platform.toUpperCase()).join(', ')} - No reach or engagement data (API issue or truly no performance?)`);
    }

    console.log('');
  }

  console.log('═'.repeat(100));
  console.log('📊 SUMMARY - ALL BRANDS COMPARED');
  console.log('═'.repeat(100));
  console.log('');

  // Cross-brand comparison
  const allPlatforms = new Set<string>();
  brands.forEach(brand => {
    if (data[brand]) {
      Object.keys(data[brand]).forEach(p => allPlatforms.add(p));
    }
  });

  allPlatforms.forEach(platform => {
    console.log(`\n${platform.toUpperCase()}:`);
    brands.forEach(brand => {
      if (data[brand] && data[brand][platform]) {
        const stats = data[brand][platform];
        const postCount = stats.posts.length;
        const avgReach = stats.totalReach / postCount;
        const totalEngagement = stats.totalLikes + stats.totalComments + stats.totalShares + stats.totalSaves;
        const avgEngagement = totalEngagement / postCount;

        console.log(
          `  ${brand.padEnd(12)} | ` +
          `${postCount.toString().padStart(3)} posts | ` +
          `${avgReach.toFixed(0).padStart(6)} reach | ` +
          `${avgEngagement.toFixed(2).padStart(6)} engagement/post`
        );
      }
    });
  });

  console.log('\n' + '═'.repeat(100));
  console.log('💡 KEY INSIGHTS');
  console.log('═'.repeat(100));
  console.log(`
- REACH is available for some platforms (Instagram shows reach even when views = 0)
- ENGAGEMENT (likes + comments + shares + saves) shows actual audience interaction
- Use ENGAGEMENT RATE (engagement/reach) to measure performance
- YouTube has views data, Instagram/TikTok/Twitter may only have reach
- Focus on platforms with high reach OR high engagement
  `);
}

main().catch(console.error);
