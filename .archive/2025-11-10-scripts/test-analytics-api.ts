#!/usr/bin/env tsx
/**
 * Test Analytics API and UI Data
 */

async function testAPI() {
  console.log('🧪 Testing Platform Analytics API\n');

  const brands = ['carz', 'podcast', 'abdullah'];

  for (const brand of brands) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${brand.toUpperCase()}`);
    console.log('='.repeat(80));

    try {
      const response = await fetch(`http://localhost:3000/api/analytics/platforms?brand=${brand}&days=30`);
      const data = await response.json();

      if (!data.success) {
        console.error(`❌ API Error:`, data.error);
        continue;
      }

      console.log(`\n✅ API Response OK`);
      console.log(`   Platforms: ${data.data.platforms?.length || 0}`);
      console.log(`   Optimization Insights: ${data.data.optimizationInsights?.length || 0}`);

      // Verify optimization insights structure
      if (data.data.optimizationInsights && data.data.optimizationInsights.length > 0) {
        console.log(`\n📊 Optimization Insights:\n`);

        data.data.optimizationInsights.forEach((insight: any) => {
          console.log(`   ${insight.platform.toUpperCase()}:`);
          console.log(`      Priority: ${insight.priority}`);
          console.log(`      Trend: ${insight.trend} (${insight.trendPercent}%)`);
          console.log(`      Total Posts: ${insight.totalPosts}`);
          console.log(`      Avg Reach: ${insight.avgReach.toFixed(0)}`);
          console.log(`      Avg Views: ${insight.avgViews.toFixed(0)}`);
          console.log(`      Avg Engagement: ${insight.avgEngagement.toFixed(2)}`);
          console.log(`      Best Hours: ${insight.bestHours.map((h: any) => h.hour).join(', ')}`);
          console.log(`      Worst Hours: ${insight.worstHours.map((h: any) => h.hour).join(', ')}`);
          console.log(`      Best Days: ${insight.bestDays.join(', ')}`);
          console.log(`      Worst Days: ${insight.worstDays.join(', ')}`);
          console.log(`      Actions: ${insight.actions.length} action items`);
          console.log('');
        });

        // Group by priority
        const byPriority = data.data.optimizationInsights.reduce((acc: any, i: any) => {
          if (!acc[i.priority]) acc[i.priority] = [];
          acc[i.priority].push(i.platform);
          return acc;
        }, {});

        console.log(`\n🎯 Priority Breakdown:`);
        if (byPriority.urgent) console.log(`   🚨 URGENT: ${byPriority.urgent.join(', ')}`);
        if (byPriority['double-down']) console.log(`   ✅ DOUBLE DOWN: ${byPriority['double-down'].join(', ')}`);
        if (byPriority.optimize) console.log(`   ⚙️  OPTIMIZE: ${byPriority.optimize.join(', ')}`);
      } else {
        console.log(`\n⚠️  No optimization insights returned`);
      }

    } catch (error) {
      console.error(`❌ Error testing ${brand}:`, error);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ API Testing Complete');
  console.log('='.repeat(80));
  console.log(`\n📋 Next Steps:`);
  console.log(`   1. Open http://localhost:3000/admin/analytics`);
  console.log(`   2. Select a brand from dropdown (carz, podcast, abdullah)`);
  console.log(`   3. Click "🎯 Show Optimization" button`);
  console.log(`   4. Verify you see:`);
  console.log(`      - Priority sections (URGENT, DOUBLE DOWN, OPTIMIZE)`);
  console.log(`      - Platform cards with trends and metrics`);
  console.log(`      - Best/worst hours and days`);
  console.log(`      - Action items for each platform`);
  console.log('');
}

testAPI().catch(console.error);
