import { NextRequest, NextResponse } from 'next/server';
import { getStats, getWorkflowQueueStats } from '@/lib/feed-store-firestore';

interface Recommendation {
  id: string;
  type: 'success' | 'warning' | 'info' | 'critical';
  category: 'performance' | 'content' | 'scheduling' | 'technical';
  title: string;
  description: string;
  action: string;
  impact: 'high' | 'medium' | 'low';
  copyPasteText: string; // For easy sharing with Claude
}

interface AnalyticsData {
  timestamp: string;
  brands: {
    carz: BrandAnalytics;
    ownerfi: BrandAnalytics;
  };
  recommendations: Recommendation[];
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  keyMetrics: {
    totalVideosGenerated: number;
    successRate: number;
    averageProcessingTime: string;
    contentQuality: string;
  };
}

interface BrandAnalytics {
  totalFeeds: number;
  activeFeeds: number;
  totalArticles: number;
  unprocessedArticles: number;
  videosGenerated: number;
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  successRate: number;
  health: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Generate recommendations based on workflow analytics
 */
function generateRecommendations(
  carzStats: BrandAnalytics,
  ownerfiStats: BrandAnalytics
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let recId = 1;

  // === CONTENT QUALITY RECOMMENDATIONS ===

  // Low unprocessed articles
  if (carzStats.unprocessedArticles < 5) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'warning',
      category: 'content',
      title: 'Low Article Queue for Carz',
      description: `Only ${carzStats.unprocessedArticles} unprocessed articles available. Risk of running out of content.`,
      action: 'Add more RSS feeds or reduce video generation frequency',
      impact: 'high',
      copyPasteText: `⚠️ CONTENT ISSUE - Carz Inc\n\nProblem: Only ${carzStats.unprocessedArticles} articles in queue\nRisk: May run out of content soon\n\nRecommended Actions:\n1. Add 2-3 new high-quality RSS feeds\n2. Check existing feeds for new content\n3. Consider reducing daily video limit from 5 to 3\n\nImpact: HIGH - Could interrupt posting schedule`
    });
  }

  if (ownerfiStats.unprocessedArticles < 5) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'warning',
      category: 'content',
      title: 'Low Article Queue for OwnerFi',
      description: `Only ${ownerfiStats.unprocessedArticles} unprocessed articles available. Risk of running out of content.`,
      action: 'Add more RSS feeds or reduce video generation frequency',
      impact: 'high',
      copyPasteText: `⚠️ CONTENT ISSUE - OwnerFi\n\nProblem: Only ${ownerfiStats.unprocessedArticles} articles in queue\nRisk: May run out of content soon\n\nRecommended Actions:\n1. Add 2-3 new high-quality RSS feeds\n2. Check existing feeds for new content\n3. Consider reducing daily video limit from 5 to 3\n\nImpact: HIGH - Could interrupt posting schedule`
    });
  }

  // Excellent content queue
  if (carzStats.unprocessedArticles >= 20) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'success',
      category: 'content',
      title: 'Healthy Article Queue for Carz',
      description: `${carzStats.unprocessedArticles} articles ready. Excellent content buffer.`,
      action: 'Consider increasing daily video generation to maximize engagement',
      impact: 'medium',
      copyPasteText: `✅ CONTENT HEALTH - Carz Inc\n\nStatus: ${carzStats.unprocessedArticles} articles in queue\nHealth: EXCELLENT\n\nOpportunity:\nCould increase daily video limit from 5 to 7 to take advantage of strong content pipeline\n\nImpact: MEDIUM - More content = more engagement`
    });
  }

  if (ownerfiStats.unprocessedArticles >= 20) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'success',
      category: 'content',
      title: 'Healthy Article Queue for OwnerFi',
      description: `${ownerfiStats.unprocessedArticles} articles ready. Excellent content buffer.`,
      action: 'Consider increasing daily video generation to maximize engagement',
      impact: 'medium',
      copyPasteText: `✅ CONTENT HEALTH - OwnerFi\n\nStatus: ${ownerfiStats.unprocessedArticles} articles in queue\nHealth: EXCELLENT\n\nOpportunity:\nCould increase daily video limit from 5 to 7 to take advantage of strong content pipeline\n\nImpact: MEDIUM - More content = more engagement`
    });
  }

  // === WORKFLOW PERFORMANCE RECOMMENDATIONS ===

  // High failure rate
  if (carzStats.successRate < 80) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'critical',
      category: 'technical',
      title: 'Low Success Rate for Carz',
      description: `Only ${carzStats.successRate.toFixed(1)}% of workflows completing successfully. High failure rate detected.`,
      action: 'Investigate failed workflows immediately - check HeyGen/Submagic errors',
      impact: 'high',
      copyPasteText: `🚨 CRITICAL - Carz Workflow Failures\n\nSuccess Rate: ${carzStats.successRate.toFixed(1)}%\nFailed: ${carzStats.queueStats.failed} workflows\n\nImmediate Actions Needed:\n1. Check /admin/social-dashboard for error messages\n2. Review HeyGen API credits and limits\n3. Verify Submagic API key is valid\n4. Check webhook configurations\n\nImpact: HIGH - Videos not being published`
    });
  }

  if (ownerfiStats.successRate < 80) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'critical',
      category: 'technical',
      title: 'Low Success Rate for OwnerFi',
      description: `Only ${ownerfiStats.successRate.toFixed(1)}% of workflows completing successfully. High failure rate detected.`,
      action: 'Investigate failed workflows immediately - check HeyGen/Submagic errors',
      impact: 'high',
      copyPasteText: `🚨 CRITICAL - OwnerFi Workflow Failures\n\nSuccess Rate: ${ownerfiStats.successRate.toFixed(1)}%\nFailed: ${ownerfiStats.queueStats.failed} workflows\n\nImmediate Actions Needed:\n1. Check /admin/social-dashboard for error messages\n2. Review HeyGen API credits and limits\n3. Verify Submagic API key is valid\n4. Check webhook configurations\n\nImpact: HIGH - Videos not being published`
    });
  }

  // Excellent success rate
  if (carzStats.successRate >= 95) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'success',
      category: 'performance',
      title: 'Excellent Workflow Performance for Carz',
      description: `${carzStats.successRate.toFixed(1)}% success rate. System running smoothly.`,
      action: 'Maintain current configuration and monitoring schedule',
      impact: 'low',
      copyPasteText: `✅ PERFORMANCE - Carz Inc\n\nSuccess Rate: ${carzStats.successRate.toFixed(1)}%\nStatus: EXCELLENT\n\nSystem is running optimally. No immediate action needed.\n\nRecommendation: Maintain current monitoring schedule`
    });
  }

  if (ownerfiStats.successRate >= 95) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'success',
      category: 'performance',
      title: 'Excellent Workflow Performance for OwnerFi',
      description: `${ownerfiStats.successRate.toFixed(1)}% success rate. System running smoothly.`,
      action: 'Maintain current configuration and monitoring schedule',
      impact: 'low',
      copyPasteText: `✅ PERFORMANCE - OwnerFi\n\nSuccess Rate: ${ownerfiStats.successRate.toFixed(1)}%\nStatus: EXCELLENT\n\nSystem is running optimally. No immediate action needed.\n\nRecommendation: Maintain current monitoring schedule`
    });
  }

  // === SCHEDULING RECOMMENDATIONS ===

  // Stuck workflows
  if (carzStats.queueStats.processing > 5) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'warning',
      category: 'technical',
      title: 'Multiple Workflows Stuck Processing (Carz)',
      description: `${carzStats.queueStats.processing} workflows stuck in processing state`,
      action: 'Check for webhook delivery issues or API timeouts',
      impact: 'medium',
      copyPasteText: `⚠️ WORKFLOW BOTTLENECK - Carz\n\nStuck Workflows: ${carzStats.queueStats.processing}\n\nPossible Causes:\n1. Webhook delivery failures\n2. HeyGen processing delays\n3. Submagic queue backup\n\nActions:\n1. Check webhook logs for errors\n2. Verify external API status\n3. Consider manual retry of stuck workflows\n\nImpact: MEDIUM - Delayed posting schedule`
    });
  }

  if (ownerfiStats.queueStats.processing > 5) {
    recommendations.push({
      id: `rec_${recId++}`,
      type: 'warning',
      category: 'technical',
      title: 'Multiple Workflows Stuck Processing (OwnerFi)',
      description: `${ownerfiStats.queueStats.processing} workflows stuck in processing state`,
      action: 'Check for webhook delivery issues or API timeouts',
      impact: 'medium',
      copyPasteText: `⚠️ WORKFLOW BOTTLENECK - OwnerFi\n\nStuck Workflows: ${ownerfiStats.queueStats.processing}\n\nPossible Causes:\n1. Webhook delivery failures\n2. HeyGen processing delays\n3. Submagic queue backup\n\nActions:\n1. Check webhook logs for errors\n2. Verify external API status\n3. Consider manual retry of stuck workflows\n\nImpact: MEDIUM - Delayed posting schedule`
    });
  }

  // === BEST PRACTICES RECOMMENDATIONS ===

  // Always include posting time optimization
  recommendations.push({
    id: `rec_${recId++}`,
    type: 'info',
    category: 'scheduling',
    title: 'Optimal Posting Times',
    description: 'Current schedule uses 5 time slots per day (9AM, 11AM, 2PM, 6PM, 8PM ET)',
    action: 'Monitor engagement patterns and adjust slots based on performance',
    impact: 'medium',
    copyPasteText: `📊 POSTING SCHEDULE ANALYSIS\n\nCurrent Slots: 9AM, 11AM, 2PM, 6PM, 8PM ET\n\nBest Practices:\n- Morning (9-11AM): Good for B2B content\n- Afternoon (2PM): Lower engagement typically\n- Evening (6-8PM): Peak engagement for most audiences\n\nRecommendations:\n1. Track which time slots get best engagement\n2. Consider A/B testing different times\n3. Adjust schedule based on audience timezone\n\nNext Steps:\n- Manually track engagement for 2 weeks\n- Compare morning vs evening performance\n- Optimize schedule based on data`
  });

  // Content diversity recommendation
  recommendations.push({
    id: `rec_${recId++}`,
    type: 'info',
    category: 'content',
    title: 'Content Diversity Strategy',
    description: 'Ensure RSS feeds cover diverse topics to maximize audience reach',
    action: 'Review feed sources quarterly and add new perspectives',
    impact: 'medium',
    copyPasteText: `💡 CONTENT STRATEGY\n\nCurrent Approach: Automated RSS → Video pipeline\n\nBest Practices for Viral Growth:\n1. Mix trending topics (70%) with evergreen content (30%)\n2. Diversify feed sources across multiple perspectives\n3. Monitor what competitors are posting\n4. Test different caption styles\n\nRecommendations:\n1. Add 1-2 trending news feeds per brand\n2. Mix educational + controversial content\n3. Test caption templates weekly\n4. Track which topics get most saves/shares\n\nGoal: Increase retention by 15% over 30 days`
  });

  // Platform-specific optimization
  recommendations.push({
    id: `rec_${recId++}`,
    type: 'info',
    category: 'performance',
    title: 'Platform-Specific Optimization',
    description: 'Each platform has unique best practices for video content',
    action: 'Customize content strategy per platform',
    impact: 'high',
    copyPasteText: `🎯 PLATFORM OPTIMIZATION GUIDE\n\nCurrent: Same video posted to all platforms\n\nPlatform-Specific Best Practices:\n\n📸 Instagram Reels:\n- First 3 seconds are critical\n- Use trending audio when possible\n- Hook: Ask question or make bold claim\n- Best times: 6-9PM, Wed-Fri\n\n🎵 TikTok:\n- First 1 second decides everything\n- Jump cuts every 3-4 seconds\n- Text overlays + captions essential\n- Best times: 7-9AM, 6-10PM\n\n📺 YouTube Shorts:\n- Thumbnail matters even for shorts\n- First 5 seconds = preview\n- Include CTA at end\n- Best times: 12-3PM, 7-10PM\n\nFacebook/LinkedIn:\n- Add context in caption\n- Tag relevant pages/people\n- Best times: 1-3PM weekdays\n\nNext Steps:\n1. A/B test video openings\n2. Create platform-specific caption templates\n3. Monitor which platforms drive most engagement\n4. Allocate more resources to top performers`
  });

  return recommendations;
}

/**
 * Calculate brand health score
 */
function calculateHealth(stats: BrandAnalytics): 'excellent' | 'good' | 'fair' | 'poor' {
  const score = stats.successRate;

  if (score >= 95) return 'excellent';
  if (score >= 85) return 'good';
  if (score >= 70) return 'fair';
  return 'poor';
}

/**
 * GET /api/analytics/recommendations
 * Returns workflow analytics and actionable recommendations
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch stats for both brands
    const [carzStats, ownerfiStats] = await Promise.all([
      getStats('carz'),
      getStats('ownerfi')
    ]);

    const [carzQueue, ownerfiQueue] = await Promise.all([
      getWorkflowQueueStats('carz'),
      getWorkflowQueueStats('ownerfi')
    ]);

    // Calculate success rates
    const carzTotal = carzQueue.completed + carzQueue.failed;
    const carzSuccessRate = carzTotal > 0 ? (carzQueue.completed / carzTotal) * 100 : 100;

    const ownerfiTotal = ownerfiQueue.completed + ownerfiQueue.failed;
    const ownerfiSuccessRate = ownerfiTotal > 0 ? (ownerfiQueue.completed / ownerfiTotal) * 100 : 100;

    const carzAnalytics: BrandAnalytics = {
      totalFeeds: carzStats.totalFeeds,
      activeFeeds: carzStats.activeFeeds,
      totalArticles: carzStats.totalArticles,
      unprocessedArticles: carzStats.unprocessedArticles,
      videosGenerated: carzStats.videosGenerated,
      queueStats: {
        pending: carzQueue.pending,
        processing: carzQueue.heygen_processing + carzQueue.submagic_processing + carzQueue.posting,
        completed: carzQueue.completed,
        failed: carzQueue.failed
      },
      successRate: carzSuccessRate,
      health: calculateHealth({ successRate: carzSuccessRate } as BrandAnalytics)
    };

    const ownerfiAnalytics: BrandAnalytics = {
      totalFeeds: ownerfiStats.totalFeeds,
      activeFeeds: ownerfiStats.activeFeeds,
      totalArticles: ownerfiStats.totalArticles,
      unprocessedArticles: ownerfiStats.unprocessedArticles,
      videosGenerated: ownerfiStats.videosGenerated,
      queueStats: {
        pending: ownerfiQueue.pending,
        processing: ownerfiQueue.heygen_processing + ownerfiQueue.submagic_processing + ownerfiQueue.posting,
        completed: ownerfiQueue.completed,
        failed: ownerfiQueue.failed
      },
      successRate: ownerfiSuccessRate,
      health: calculateHealth({ successRate: ownerfiSuccessRate } as BrandAnalytics)
    };

    // Generate recommendations
    const recommendations = generateRecommendations(carzAnalytics, ownerfiAnalytics);

    // Calculate overall health
    const avgSuccessRate = (carzSuccessRate + ownerfiSuccessRate) / 2;
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    if (avgSuccessRate >= 95) overallHealth = 'excellent';
    else if (avgSuccessRate >= 85) overallHealth = 'good';
    else if (avgSuccessRate >= 70) overallHealth = 'fair';
    else overallHealth = 'poor';

    const response: AnalyticsData = {
      timestamp: new Date().toISOString(),
      brands: {
        carz: carzAnalytics,
        ownerfi: ownerfiAnalytics
      },
      recommendations,
      overallHealth,
      keyMetrics: {
        totalVideosGenerated: carzStats.videosGenerated + ownerfiStats.videosGenerated,
        successRate: avgSuccessRate,
        averageProcessingTime: '45-60 minutes',
        contentQuality: 'AI-filtered (80+ score required)'
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error generating analytics:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
