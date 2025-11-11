#!/usr/bin/env tsx
/**
 * Compare Late.dev Queue Schedules to UNIFIED Multi-Platform Recommendations
 *
 * Since all platforms post at the same time, this compares your actual queue
 * times against the unified schedule that works best across ALL platforms.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const LATE_API_KEY = process.env.LATE_API_KEY;

const profiles = {
  carz: process.env.LATE_CARZ_PROFILE_ID,
  podcast: process.env.LATE_PODCAST_PROFILE_ID,
  abdullah: process.env.LATE_ABDULLAH_PROFILE_ID,
};

async function fetchQueueSlots(profileId: string) {
  const response = await fetch(`https://getlate.dev/api/v1/queue/slots?profileId=${profileId}`, {
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch queue slots: ${response.status}`);
  }

  return await response.json();
}

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
  const hourScores = new Map<number, HourScore>();

  for (let hour = 0; hour < 24; hour++) {
    hourScores.set(hour, {
      hour,
      totalScore: 0,
      platforms: [],
      details: []
    });
  }

  insights.forEach(insight => {
    const platform = insight.platform;

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
  const currentDaily = totalPosts / 30;

  const improving = insights.filter(i => i.trend === 'improving').length;
  const declining = insights.filter(i => i.trend === 'declining').length;

  let targetDaily = currentDaily;

  if (declining > improving) {
    targetDaily = Math.max(currentDaily * 0.9, 2);
  } else if (improving > 0) {
    targetDaily = Math.min(currentDaily * 1.5, 6);
  }

  return Math.round(targetDaily * 2) / 2;
}

function createUnifiedSchedule(hourScores: Map<number, HourScore>, postsPerDay: number) {
  const sortedHours = Array.from(hourScores.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const goodHours = sortedHours.filter(h => h.totalScore >= 0);
  const availableHours = postsPerDay > 3 ? sortedHours : goodHours;

  const numSlots = Math.ceil(postsPerDay);
  const selectedSlots: Array<{ hour: number; score: number; reason: string }> = [];

  let lastHour = -6;

  for (const hourData of availableHours) {
    const hourDiff = hourData.hour - lastHour;

    if (hourDiff >= 3 || hourDiff < -20) {
      selectedSlots.push({
        hour: hourData.hour,
        score: hourData.totalScore,
        reason: hourData.totalScore > 0
          ? `Best for: ${hourData.platforms.join(', ')}`
          : 'Neutral hour'
      });

      lastHour = hourData.hour;

      if (selectedSlots.length >= numSlots) break;
    }
  }

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
  console.log('🔍 UNIFIED QUEUE COMPARISON - Current vs Recommended Multi-Platform Schedules');
  console.log('═'.repeat(100));
  console.log('\nSince all platforms post at the same time, comparing actual queue times');
  console.log('against unified schedules optimized across ALL platforms.\n');

  for (const [brand, profileId] of Object.entries(profiles)) {
    if (!profileId) {
      console.log(`⚠️  ${brand.toUpperCase()}: No profile ID configured\n`);
      continue;
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`📱 ${brand.toUpperCase()}`);
    console.log('═'.repeat(100));

    try {
      // Fetch optimization insights
      const insights = await getOptimizationData(brand);

      if (insights.length === 0) {
        console.log(`⚠️  No optimization data available for ${brand}`);
        continue;
      }

      // Calculate unified schedule
      const hourScores = analyzeUnifiedSchedule(insights);
      const targetPostsPerDay = calculatePostingFrequency(insights);
      const recommendedSchedule = createUnifiedSchedule(hourScores, targetPostsPerDay);
      const recommendedHours = recommendedSchedule.map(s => s.hour);

      // Get worst hours (negative scores)
      const worstHours = Array.from(hourScores.entries())
        .filter(([_, data]) => data.totalScore < 0)
        .sort((a, b) => a[1].totalScore - b[1].totalScore)
        .slice(0, 5)
        .map(([hour]) => hour);

      // Fetch current queue schedule
      const queueData = await fetchQueueSlots(profileId);
      const slots = queueData.schedule || [];

      console.log(`\n✅ Found ${slots.length} queue time slots configured`);

      // Extract current schedule - slots have dayOfWeek (0-6) and time (HH:mm)
      let currentHours: number[] = [];

      if (slots.length > 0) {
        // Extract unique hours from all slots (ignoring day of week for now)
        const hourSet = new Set<number>();
        slots.forEach((slot: any) => {
          // slot.time is in format "HH:mm"
          const [hourStr] = slot.time.split(':');
          const hour = parseInt(hourStr, 10);
          hourSet.add(hour);
        });
        currentHours = Array.from(hourSet).sort((a, b) => a - b);
      }

      // Current state
      console.log('\n📊 CURRENT POSTING SCHEDULE:\n');
      if (currentHours.length === 0) {
        console.log('   ❌ NO POSTING TIMES CONFIGURED');
      } else {
        console.log(`   Posting ${currentHours.length}x per day at:\n`);
        currentHours.forEach(hour => {
          const isRecommended = recommendedHours.includes(hour);
          const isBad = worstHours.includes(hour);
          const hourData = hourScores.get(hour)!;
          const icon = isRecommended ? '✅' : isBad ? '❌' : '⚠️ ';

          console.log(`   ${icon} ${hour.toString().padStart(2, '0')}:00 UTC (Score: ${hourData.totalScore.toString().padStart(4)})`);
          if (isRecommended) {
            console.log(`      ✅ GOOD - Matches recommendation`);
          } else if (isBad) {
            console.log(`      ❌ BAD - Worst performing time across platforms`);
          } else {
            console.log(`      ⚠️  SUBOPTIMAL - Not in top recommended times`);
          }
        });
      }

      // Recommended state
      console.log(`\n\n🎯 RECOMMENDED UNIFIED SCHEDULE:\n`);
      console.log(`   Post ${targetPostsPerDay}x per day at:\n`);

      recommendedSchedule.forEach((slot, index) => {
        const isCurrent = currentHours.includes(slot.hour);
        const mark = isCurrent ? '✅ ALREADY SET' : '➕ ADD THIS';
        console.log(`   ${(index + 1).toString().padStart(2)}. ${slot.hour.toString().padStart(2, '0')}:00 UTC (Score: ${slot.score.toString().padStart(4)}) ${mark}`);
        console.log(`      ${slot.reason}`);
      });

      // Analysis
      const matchingTimes = currentHours.filter(h => recommendedHours.includes(h));
      const wrongTimes = currentHours.filter(h => !recommendedHours.includes(h));
      const missingTimes = recommendedHours.filter(h => !currentHours.includes(h));
      const postingAtWorst = currentHours.filter(h => worstHours.includes(h));

      console.log(`\n\n🔍 ANALYSIS:\n`);

      if (matchingTimes.length > 0) {
        console.log(`   ✅ Correct: ${matchingTimes.length}/${currentHours.length} times match recommendations`);
        console.log(`      ${matchingTimes.map(h => h.toString().padStart(2, '0') + ':00').join(', ')}`);
      }

      if (postingAtWorst.length > 0) {
        console.log(`\n   ❌ CRITICAL: Posting at ${postingAtWorst.length} WORST times!`);
        console.log(`      ${postingAtWorst.map(h => h.toString().padStart(2, '0') + ':00').join(', ')}`);
        console.log(`      These hours perform poorly across multiple platforms`);
      }

      if (wrongTimes.length > 0) {
        console.log(`\n   ⚠️  Suboptimal: ${wrongTimes.length} times should be changed`);
        console.log(`      ${wrongTimes.map(h => h.toString().padStart(2, '0') + ':00').join(', ')}`);
      }

      if (missingTimes.length > 0) {
        console.log(`\n   ➕ Missing: ${missingTimes.length} recommended times not being used`);
        console.log(`      ${missingTimes.map(h => h.toString().padStart(2, '0') + ':00').join(', ')}`);
      }

      const freqDiff = targetPostsPerDay - currentHours.length;
      if (Math.abs(freqDiff) > 0) {
        const direction = freqDiff > 0 ? '📈 INCREASE' : '📉 DECREASE';
        console.log(`\n   ${direction} frequency by ${Math.abs(freqDiff).toFixed(1)} posts/day`);
        console.log(`      Current: ${currentHours.length} times/day → Target: ${targetPostsPerDay} times/day`);
      }

      // Action items
      console.log(`\n\n📝 ACTION ITEMS:\n`);

      let actionNum = 1;

      if (postingAtWorst.length > 0) {
        console.log(`   ${actionNum}. 🚨 URGENT - Remove worst-performing times:`);
        postingAtWorst.forEach(h => {
          console.log(`      ❌ Delete ${h.toString().padStart(2, '0')}:00 from queue`);
        });
        actionNum++;
      }

      if (missingTimes.length > 0) {
        console.log(`\n   ${actionNum}. ➕ Add recommended times:`);
        missingTimes.forEach(h => {
          const slot = recommendedSchedule.find(s => s.hour === h)!;
          console.log(`      ✅ Add ${h.toString().padStart(2, '0')}:00 to queue (${slot.reason})`);
        });
        actionNum++;
      }

      if (wrongTimes.length > 0 && wrongTimes.length !== postingAtWorst.length) {
        console.log(`\n   ${actionNum}. ⚠️  Consider replacing suboptimal times:`);
        wrongTimes.filter(h => !postingAtWorst.includes(h)).forEach(h => {
          console.log(`      → Replace ${h.toString().padStart(2, '0')}:00 with better option`);
        });
        actionNum++;
      }

      // Platform breakdown
      console.log(`\n\n📊 PLATFORM PERFORMANCE SUMMARY:\n`);
      insights.forEach((insight: any) => {
        const trendIcon = insight.trend === 'improving' ? '📈' : insight.trend === 'declining' ? '📉' : '➡️';
        const priorityIcon = insight.priority === 'urgent' ? '🚨' : insight.priority === 'double-down' ? '✅' : '⚙️';

        console.log(`   ${trendIcon} ${priorityIcon} ${insight.platform.toUpperCase()}: ${insight.trend} ${insight.trendPercent}%`);
        console.log(`      Posts: ${insight.totalPosts}/month | Reach: ${insight.avgReach.toFixed(0)} | Engagement: ${insight.avgEngagement.toFixed(1)}`);
      });

    } catch (error) {
      console.error(`\n❌ Error analyzing ${brand}:`, error);
    }
  }

  console.log('\n\n' + '═'.repeat(100));
  console.log('💡 IMPLEMENTATION GUIDE');
  console.log('═'.repeat(100));
  console.log(`
1. Log into getlate.dev
2. For each brand (carz, podcast, abdullah):
   - Go to the queue settings
   - REMOVE all times marked with ❌ (worst performers)
   - ADD all times marked with ➕ (recommended additions)
   - Adjust frequency to match target posts/day

3. All platforms share the same posting times (unified schedule)
   - The recommendations above work best across ALL platforms
   - Hours with high positive scores = good for multiple platforms
   - Hours with negative scores = bad for multiple platforms

4. Verify changes by re-running this script next week
5. Monitor performance in admin/analytics dashboard

The algorithm balances:
- Instagram reach & engagement
- YouTube views & engagement
- TikTok reach (when available)
- Twitter engagement (when available)
  `);
}

main().catch(console.error);
