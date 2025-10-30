#!/usr/bin/env tsx
/**
 * Automated Queue Optimization
 *
 * Analyzes platform performance and automatically adjusts posting schedules
 * to maximize engagement and viewer retention
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { analyzePlatformPerformance } from '../src/lib/late-analytics-v2';
import { setQueueSchedule } from '../src/lib/late-api';

interface QueueSlot {
  dayOfWeek: number;
  time: string; // "HH:mm"
}

/**
 * Generate optimal queue slots based on platform analytics
 */
async function generateOptimalQueue(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah',
  targetPostsPerWeek: number = 14 // Default: 2 posts/day
): Promise<QueueSlot[]> {
  console.log(`\n📊 Generating optimal queue for ${brand}...`);

  // Analyze last 30 days of performance
  const performance = await analyzePlatformPerformance(brand, 30);

  if (performance.size === 0) {
    console.log(`   ⚠️  No analytics data available for ${brand}`);
    return [];
  }

  // Collect all peak hours across platforms weighted by engagement
  const hourScores = new Map<number, { score: number; platforms: number }>();

  for (const [platform, perf] of performance.entries()) {
    // Weight platforms by engagement rate
    const platformWeight = perf.avgEngagementRate;

    perf.peakHours.forEach(hour => {
      const existing = hourScores.get(hour.hour) || { score: 0, platforms: 0 };
      existing.score += hour.avgViews * platformWeight;
      existing.platforms += 1;
      hourScores.set(hour.hour, existing);
    });
  }

  // Sort hours by score
  const rankedHours = Array.from(hourScores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .map(([hour]) => hour);

  console.log(`   Top performing hours: ${rankedHours.slice(0, 5).join(', ')}`);

  // Collect day-of-week scores
  const dayScores = new Map<number, number>();

  for (const [_, perf] of performance.entries()) {
    const platformWeight = perf.avgEngagementRate;

    perf.peakDays.forEach(day => {
      const existing = dayScores.get(day.dayOfWeek) || 0;
      dayScores.set(day.dayOfWeek, existing + day.avgViews * platformWeight);
    });
  }

  const rankedDays = Array.from(dayScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([day]) => day);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log(`   Top performing days: ${rankedDays.slice(0, 3).map(d => dayNames[d]).join(', ')}`);

  // Generate queue slots
  const slots: QueueSlot[] = [];
  const postsPerDay = Math.ceil(targetPostsPerWeek / 7);

  console.log(`   Generating ${targetPostsPerWeek} slots (${postsPerDay} per day)...`);

  // Distribute posts across the week
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayOfWeek = rankedDays[dayIndex % rankedDays.length];

    for (let postIndex = 0; postIndex < postsPerDay; postIndex++) {
      // Get best hour for this post slot
      const hourIndex = (dayIndex * postsPerDay + postIndex) % rankedHours.length;
      const hour = rankedHours[hourIndex];

      // Add some variation (±30 mins) to spread posts, capped at 59 minutes
      const minuteVariation = Math.min((postIndex * 30) % 60, 59);

      slots.push({
        dayOfWeek,
        time: `${hour.toString().padStart(2, '0')}:${minuteVariation.toString().padStart(2, '0')}`
      });
    }
  }

  // Sort slots by day and time
  slots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.time.localeCompare(b.time);
  });

  return slots.slice(0, targetPostsPerWeek);
}

/**
 * Main optimization function
 */
async function optimizeAllQueues() {
  console.log('═'.repeat(80));
  console.log('🎯 AUTOMATED QUEUE OPTIMIZATION');
  console.log('═'.repeat(80));

  const brands: Array<{ brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah'; postsPerWeek: number }> = [
    { brand: 'ownerfi', postsPerWeek: 21 },  // 3 posts/day (high engagement)
    { brand: 'carz', postsPerWeek: 14 },     // 2 posts/day
    { brand: 'podcast', postsPerWeek: 7 },   // 1 post/day
    { brand: 'vassdistro', postsPerWeek: 14 }, // 2 posts/day
    { brand: 'abdullah', postsPerWeek: 21 }  // 3 posts/day (high engagement)
  ];

  const results: any[] = [];

  for (const { brand, postsPerWeek } of brands) {
    try {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📱 ${brand.toUpperCase()}`);

      // Generate optimal slots
      const slots = await generateOptimalQueue(brand, postsPerWeek);

      if (slots.length === 0) {
        console.log(`   ⚠️  Skipping ${brand} - no data available`);
        continue;
      }

      console.log(`\n   Generated ${slots.length} optimal posting slots:`);

      // Group by day for display
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const slotsByDay = new Map<number, string[]>();

      slots.forEach(slot => {
        const times = slotsByDay.get(slot.dayOfWeek) || [];
        times.push(slot.time);
        slotsByDay.set(slot.dayOfWeek, times);
      });

      Array.from(slotsByDay.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([day, times]) => {
          console.log(`   ${dayNames[day].padEnd(10)}: ${times.join(', ')}`);
        });

      // Store result for summary
      results.push({
        brand,
        slots,
        postsPerWeek
      });

      // Ask for confirmation before applying
      console.log(`\n   💡 Review the schedule above for ${brand}`);

    } catch (error) {
      console.error(`   ❌ Error optimizing ${brand}:`, error);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📋 OPTIMIZATION SUMMARY');
  console.log('═'.repeat(80));

  results.forEach(({ brand, slots }) => {
    console.log(`\n${brand.toUpperCase()}:`);
    console.log(`   ✅ ${slots.length} optimized time slots generated`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('🚀 NEXT STEPS:');
  console.log('═'.repeat(80));
  console.log('\n1. Review the suggested schedules above');
  console.log('2. To apply these changes, run:');
  console.log('   npx tsx scripts/apply-optimized-queues.ts');
  console.log('\n3. Or manually update queues in Late.dev dashboard');
  console.log('\n4. Monitor performance for 1 week and re-optimize if needed');

  console.log('\n💡 Pro Tips:');
  console.log('   • Run this script weekly to adapt to changing trends');
  console.log('   • A/B test new time slots gradually (change 2-3 at a time)');
  console.log('   • High engagement platforms get more frequent slots');
  console.log('   • Peak hours from analytics drive the schedule');

  console.log('\n' + '═'.repeat(80));
}

/**
 * Apply optimized queues (with confirmation)
 */
async function applyOptimizedQueues(dryRun: boolean = true) {
  console.log('═'.repeat(80));
  console.log(dryRun ? '🔍 DRY RUN: Applying Optimized Queues' : '🚀 APPLYING OPTIMIZED QUEUES');
  console.log('═'.repeat(80));

  const brands: Array<{ brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah'; postsPerWeek: number }> = [
    { brand: 'ownerfi', postsPerWeek: 21 },
    { brand: 'carz', postsPerWeek: 14 },
    { brand: 'podcast', postsPerWeek: 7 },
    { brand: 'vassdistro', postsPerWeek: 14 },
    { brand: 'abdullah', postsPerWeek: 21 }
  ];

  for (const { brand, postsPerWeek } of brands) {
    try {
      console.log(`\n📱 ${brand.toUpperCase()}`);

      const slots = await generateOptimalQueue(brand, postsPerWeek);

      if (slots.length === 0) {
        console.log(`   ⚠️  Skipping - no data available`);
        continue;
      }

      if (dryRun) {
        console.log(`   ✅ Generated ${slots.length} slots (dry run - not applied)`);
      } else {
        console.log(`   🔄 Applying ${slots.length} slots to Late API...`);

        await setQueueSchedule(
          brand,
          slots,
          'America/New_York',
          false // Don't reshuffle existing posts
        );

        console.log(`   ✅ Queue updated successfully!`);
      }

    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }

  console.log('\n' + '═'.repeat(80));
  if (dryRun) {
    console.log('✅ DRY RUN COMPLETE');
    console.log('\nTo actually apply these changes, run:');
    console.log('   npx tsx scripts/apply-optimized-queues.ts --apply');
  } else {
    console.log('✅ ALL QUEUES UPDATED!');
  }
  console.log('═'.repeat(80));
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--apply')) {
  applyOptimizedQueues(false);
} else if (args.includes('--dry-run')) {
  applyOptimizedQueues(true);
} else {
  optimizeAllQueues();
}
