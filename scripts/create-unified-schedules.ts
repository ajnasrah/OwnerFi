#!/usr/bin/env tsx
/**
 * Create Unified Multi-Platform Posting Schedules
 *
 * Since all platforms post at the same time, find the optimal times
 * that work well across ALL platforms for each brand
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function getOptimizationData(brand: string) {
  const response = await fetch(`http://localhost:3000/api/analytics/platforms?brand=${brand}&days=30`);
  const data = await response.json();
  return data.data.optimizationInsights || [];
}

interface HourScore {
  hour: number;
  totalScore: number;
  platforms: string[];
  details: Array<{ platform: string; score: number; isBest: boolean; isWorst: boolean }>;
}

function analyzeUnifiedSchedule(insights: any[]) {
  // Create hour-by-hour scoring across all platforms
  const hourScores = new Map<number, HourScore>();

  // Initialize all 24 hours
  for (let hour = 0; hour < 24; hour++) {
    hourScores.set(hour, {
      hour,
      totalScore: 0,
      platforms: [],
      details: []
    });
  }

  // Score each hour based on platform performance
  insights.forEach(insight => {
    const platform = insight.platform;

    // Best hours get +100 points each
    insight.bestHours.forEach((h: any) => {
      const hourData = hourScores.get(h.hour)!;
      hourData.totalScore += 100;
      hourData.platforms.push(platform);
      hourData.details.push({
        platform,
        score: parseFloat(h.score),
        isBest: true,
        isWorst: false
      });
    });

    // Worst hours get -100 points each
    insight.worstHours.forEach((h: any) => {
      const hourData = hourScores.get(h.hour)!;
      hourData.totalScore -= 100;
      hourData.details.push({
        platform,
        score: parseFloat(h.score),
        isBest: false,
        isWorst: true
      });
    });
  });

  return hourScores;
}

function calculatePostingFrequency(insights: any[]): number {
  const totalPosts = insights.reduce((sum, i) => sum + i.totalPosts, 0);
  const currentDaily = totalPosts / 30; // posts per day over last 30 days

  // Count improving vs declining platforms
  const improving = insights.filter(i => i.trend === 'improving').length;
  const declining = insights.filter(i => i.trend === 'declining').length;

  // Base frequency on current + adjustments
  let targetDaily = currentDaily;

  if (declining > improving) {
    // If mostly declining, maintain or slightly reduce
    targetDaily = Math.max(currentDaily * 0.9, 2);
  } else if (improving > 0) {
    // If improving, increase frequency
    targetDaily = Math.min(currentDaily * 1.5, 6);
  }

  // Round to nearest 0.5
  return Math.round(targetDaily * 2) / 2;
}

function createSchedule(hourScores: Map<number, HourScore>, postsPerDay: number) {
  // Sort hours by total score (best to worst)
  const sortedHours = Array.from(hourScores.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => b.totalScore - a.totalScore);

  // Remove hours with negative scores (more worst than best)
  const goodHours = sortedHours.filter(h => h.totalScore >= 0);

  // If we need to post more frequently, include neutral hours too
  const availableHours = postsPerDay > 3 ? sortedHours : goodHours;

  // Calculate how many posts per day
  const numSlots = Math.ceil(postsPerDay);

  // Spread posts throughout the day (avoid clustering)
  const selectedSlots: Array<{ hour: number; score: number; reason: string }> = [];

  // First pass: get top scoring hours with spread
  let lastHour = -6; // Ensure at least 6 hours apart initially

  for (const hourData of availableHours) {
    const hourDiff = hourData.hour - lastHour;

    // Ensure minimum 3-hour gap between posts (allows ~8 posts max per day)
    if (hourDiff >= 3 || hourDiff < -20) {
      selectedSlots.push({
        hour: hourData.hour,
        score: hourData.totalScore,
        reason: hourData.totalScore > 0
          ? `Best for: ${hourData.platforms.join(', ')}`
          : 'Neutral hour (no strong preference)'
      });

      lastHour = hourData.hour;

      if (selectedSlots.length >= numSlots) break;
    }
  }

  // If we couldn't get enough slots with gaps, fill in remaining with next best
  if (selectedSlots.length < numSlots) {
    for (const hourData of availableHours) {
      if (!selectedSlots.find(s => s.hour === hourData.hour)) {
        selectedSlots.push({
          hour: hourData.hour,
          score: hourData.totalScore,
          reason: hourData.totalScore > 0
            ? `Best for: ${hourData.platforms.join(', ')}`
            : 'Fill slot'
        });

        if (selectedSlots.length >= numSlots) break;
      }
    }
  }

  return selectedSlots.sort((a, b) => a.hour - b.hour);
}

async function main() {
  console.log('═'.repeat(100));
  console.log('🎯 UNIFIED MULTI-PLATFORM POSTING SCHEDULES');
  console.log('═'.repeat(100));
  console.log('\nSince all platforms post at the same time, this creates optimized schedules');
  console.log('that balance performance across ALL platforms for each brand.\n');

  const brands = ['carz', 'podcast', 'abdullah'];

  for (const brand of brands) {
    console.log('\n' + '═'.repeat(100));
    console.log(`📱 ${brand.toUpperCase()}`);
    console.log('═'.repeat(100));

    const insights = await getOptimizationData(brand);

    if (insights.length === 0) {
      console.log('⚠️  No data available\n');
      continue;
    }

    // Current state
    console.log('\n📊 CURRENT STATE:\n');
    insights.forEach((i: any) => {
      const trendIcon = i.trend === 'improving' ? '📈' : i.trend === 'declining' ? '📉' : '➡️';
      console.log(`   ${trendIcon} ${i.platform.toUpperCase()}: ${i.totalPosts} posts/month (${(i.totalPosts / 30).toFixed(1)}/day) - ${i.trend} ${i.trendPercent}%`);
    });

    const totalPosts = insights.reduce((sum: number, i: any) => sum + i.totalPosts, 0);
    console.log(`\n   Total: ${totalPosts} posts/month (${(totalPosts / 30).toFixed(1)}/day across all platforms)`);

    // Analyze unified schedule
    const hourScores = analyzeUnifiedSchedule(insights);

    // Calculate optimal posting frequency
    const targetPostsPerDay = calculatePostingFrequency(insights);
    console.log(`\n   🎯 TARGET: ${targetPostsPerDay} posts/day (${(targetPostsPerDay * 30).toFixed(0)} posts/month)`);

    // Create schedule
    const schedule = createSchedule(hourScores, targetPostsPerDay);

    console.log('\n⏰ HOUR-BY-HOUR ANALYSIS:\n');

    // Show best hours
    const topHours = Array.from(hourScores.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10);

    topHours.forEach((h, index) => {
      const icon = h.totalScore > 50 ? '✅' : h.totalScore > 0 ? '👍' : h.totalScore >= -50 ? '⚠️ ' : '❌';
      const isSelected = schedule.find(s => s.hour === h.hour);
      const selectedMark = isSelected ? ' ← SELECTED' : '';

      console.log(`   ${icon} ${h.hour.toString().padStart(2, '0')}:00 (Score: ${h.totalScore.toString().padStart(4)})${selectedMark}`);

      h.details.forEach(d => {
        const marker = d.isBest ? '✅' : d.isWorst ? '❌' : '  ';
        console.log(`      ${marker} ${d.platform}: ${d.score.toFixed(0)} ${d.isBest ? '(best)' : d.isWorst ? '(worst)' : ''}`);
      });
    });

    console.log('\n🎯 RECOMMENDED POSTING SCHEDULE:\n');
    console.log(`   Post ${targetPostsPerDay}x per day at these times:\n`);

    schedule.forEach((slot, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${slot.hour.toString().padStart(2, '0')}:00 (Score: ${slot.score.toString().padStart(4)}) - ${slot.reason}`);
    });

    // Show what to avoid
    const worstHours = Array.from(hourScores.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .filter(h => h.totalScore < 0)
      .sort((a, b) => a.totalScore - b.totalScore)
      .slice(0, 5);

    if (worstHours.length > 0) {
      console.log('\n❌ AVOID THESE HOURS:\n');
      worstHours.forEach(h => {
        console.log(`   ${h.hour.toString().padStart(2, '0')}:00 (Score: ${h.totalScore}) - Bad for: ${h.details.filter(d => d.isWorst).map(d => d.platform).join(', ')}`);
      });
    }

    // Implementation instructions
    console.log('\n📝 IMPLEMENTATION:\n');
    console.log(`   1. Current: ${(totalPosts / 30).toFixed(1)} posts/day`);
    console.log(`   2. Target: ${targetPostsPerDay} posts/day`);
    console.log(`   3. Change: ${targetPostsPerDay > (totalPosts / 30) ? '📈 INCREASE' : targetPostsPerDay < (totalPosts / 30) ? '📉 DECREASE' : '➡️  MAINTAIN'} by ${Math.abs(targetPostsPerDay - (totalPosts / 30)).toFixed(1)} posts/day`);
    console.log(`\n   4. Set up Late.dev queue with ${schedule.length} time slots:`);
    schedule.forEach((slot, index) => {
      console.log(`      - ${slot.hour.toString().padStart(2, '0')}:00 UTC`);
    });
  }

  console.log('\n\n' + '═'.repeat(100));
  console.log('💡 SUMMARY');
  console.log('═'.repeat(100));
  console.log(`
These schedules are optimized for multi-platform posting where all platforms
post at the same time. The algorithm:

1. Scores each hour based on ALL platform performance
2. Selects hours that work well across multiple platforms
3. Avoids hours that are consistently bad for any platform
4. Spreads posts throughout the day (minimum 3-hour gaps)
5. Adjusts frequency based on performance trends

Next Steps:
1. Log into Late.dev
2. For each brand, create/update queue with the times shown above
3. Ensure you're generating enough content to hit target posts/day
4. Re-run this analysis weekly to track improvements
  `);
}

main().catch(console.error);
