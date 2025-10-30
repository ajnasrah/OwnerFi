/**
 * Content Optimizer - Uses analytics insights to optimize posting strategy
 * Based on analysis of 18k views across 393 posts
 */

export interface OptimizationInsights {
  // Best posting times (based on actual performance data)
  bestTimeSlots: Array<{
    timeSlot: string;
    avgViews: number;
    confidence: 'high' | 'medium' | 'low';
  }>;

  // Best days
  bestDays: Array<{
    day: string;
    avgViews: number;
    confidence: 'high' | 'medium' | 'low';
  }>;

  // Platform priorities
  platformPriority: Array<{
    platform: string;
    avgViews: number;
    weight: number; // 0-1
  }>;

  // Content themes that perform well
  topThemes: Array<{
    theme: string;
    avgViews: number;
    examples: string[];
  }>;
}

// Based on real data analysis
export const PERFORMANCE_INSIGHTS: OptimizationInsights = {
  bestTimeSlots: [
    { timeSlot: '19:00-20:00', avgViews: 1090, confidence: 'medium' }, // Evening prime time
    { timeSlot: '16:00-17:00', avgViews: 972, confidence: 'medium' },  // Late afternoon
    { timeSlot: '06:00-07:00', avgViews: 673, confidence: 'high' },    // Early morning (Sunday winner)
    { timeSlot: '08:00-09:00', avgViews: 535, confidence: 'high' },    // Morning (most common in top 20)
    { timeSlot: '12:00-13:00', avgViews: 499, confidence: 'medium' },  // Lunch time
  ],

  bestDays: [
    { day: 'Saturday', avgViews: 732, confidence: 'high' },
    { day: 'Sunday', avgViews: 627, confidence: 'high' },
    { day: 'Wednesday', avgViews: 575, confidence: 'high' },
    { day: 'Thursday', avgViews: 451, confidence: 'high' },
    { day: 'Friday', avgViews: 346, confidence: 'medium' },
    { day: 'Monday', avgViews: 337, confidence: 'medium' },
    { day: 'Tuesday', avgViews: 136, confidence: 'low' }, // AVOID
  ],

  platformPriority: [
    { platform: 'youtube', avgViews: 426, weight: 1.0 },      // PRIORITY #1
    { platform: 'instagram', avgViews: 50, weight: 0.3 },     // Lower priority
    { platform: 'tiktok', avgViews: 40, weight: 0.25 },
    { platform: 'facebook', avgViews: 30, weight: 0.2 },
    { platform: 'linkedin', avgViews: 20, weight: 0.15 },
    { platform: 'threads', avgViews: 15, weight: 0.1 },
  ],

  topThemes: [
    {
      theme: 'Electric Vehicles & Future Tech',
      avgViews: 950,
      examples: [
        'Future of eco-friendly driving',
        'EV sales changing the game',
        'Hydrogen-powered revolution',
      ],
    },
    {
      theme: 'Owner Financing / Real Estate',
      avgViews: 1177,
      examples: [
        'Break free from renting',
        'Credit solutions for homebuyers',
        'Alternative financing options',
      ],
    },
    {
      theme: 'Breaking News / Recalls',
      avgViews: 1056,
      examples: [
        'Tesla recall alert',
        'Driverless taxis safety concerns',
        'Ford plant fire crisis',
      ],
    },
    {
      theme: 'Luxury / Supercars',
      avgViews: 711,
      examples: [
        'Supercar icons',
        'Cadillac luxury features',
        'RTR-Spec performance',
      ],
    },
  ],
};

/**
 * Get optimal posting time based on day
 */
export function getOptimalPostingTime(dayOfWeek: string): string {
  // Weekend mornings perform best
  if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
    return '06:00-07:00'; // Early morning (673 avg views)
  }

  // Weekday evenings
  if (['Wednesday', 'Thursday'].includes(dayOfWeek)) {
    return '19:00-20:00'; // Evening prime (1090 avg views)
  }

  // Default to morning for other days
  return '08:00-09:00'; // Morning (535 avg views, most common)
}

/**
 * Score a potential posting time
 */
export function scorePostingTime(timeSlot: string, dayOfWeek: string): number {
  let score = 0;

  // Time slot scoring
  const timeData = PERFORMANCE_INSIGHTS.bestTimeSlots.find(t => t.timeSlot === timeSlot);
  if (timeData) {
    score += (timeData.avgViews / 1090) * 50; // Normalize to top performer
  }

  // Day scoring
  const dayData = PERFORMANCE_INSIGHTS.bestDays.find(d => d.day === dayOfWeek);
  if (dayData) {
    score += (dayData.avgViews / 732) * 50; // Normalize to top performer
  }

  return Math.min(score, 100); // Cap at 100
}

/**
 * Recommend which platforms to prioritize
 */
export function getPlatformRecommendations(contentType: string): string[] {
  // YouTube is king for all content types based on data
  const platforms = ['youtube'];

  // Add secondary platforms based on content type
  if (contentType === 'viral' || contentType === 'benefit') {
    platforms.push('instagram', 'tiktok'); // Visual platforms
  }

  if (contentType === 'property' || contentType === 'benefit') {
    platforms.push('facebook', 'linkedin'); // Professional networks
  }

  return platforms;
}

/**
 * Analyze caption/script and suggest improvements
 */
export function analyzeCaptionQuality(caption: string): {
  score: number;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let score = 50; // Base score

  // Check for emoji (ALL top performers use them)
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(caption);
  if (!hasEmoji) {
    suggestions.push('Add emojis - ALL top 20 videos use them');
    score -= 15;
  } else {
    score += 15;
  }

  // Check for question/engagement hook
  if (caption.includes('?')) {
    score += 10;
  } else {
    suggestions.push('Add a question to increase engagement');
  }

  // Check for urgency/FOMO words
  const urgencyWords = ['breaking', 'alert', 'new', 'now', 'today', 'limited', 'exclusive'];
  if (urgencyWords.some(word => caption.toLowerCase().includes(word))) {
    score += 10;
  }

  // Check for trending topics
  const trendingTopics = ['ev', 'electric', 'tesla', 'recall', 'future', 'owner financing'];
  if (trendingTopics.some(topic => caption.toLowerCase().includes(topic))) {
    score += 15;
    suggestions.push('Great! Using a proven high-performing topic');
  } else {
    suggestions.push('Consider using trending topics: EVs, tech, recalls, owner financing');
    score -= 10;
  }

  return { score: Math.max(0, Math.min(100, score)), suggestions };
}

/**
 * Get content theme recommendations
 */
export function getContentRecommendations(): Array<{
  theme: string;
  expectedViews: number;
  examples: string[];
}> {
  return PERFORMANCE_INSIGHTS.topThemes.map(theme => ({
    theme: theme.theme,
    expectedViews: theme.avgViews,
    examples: theme.examples,
  }));
}

/**
 * Optimize workflow scheduling based on insights
 */
export function optimizeSchedule(
  currentSchedule: Date,
  contentType: string,
  caption?: string
): {
  recommendedTime: Date;
  score: number;
  improvements: string[];
} {
  const improvements: string[] = [];
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentSchedule.getDay()];
  const currentHour = currentSchedule.getHours();
  const currentTimeSlot = `${currentHour.toString().padStart(2, '0')}:00-${((currentHour + 1) % 24).toString().padStart(2, '0')}:00`;

  // Score current time
  const currentScore = scorePostingTime(currentTimeSlot, dayOfWeek);

  // Get optimal time
  const optimalTimeSlot = getOptimalPostingTime(dayOfWeek);
  const optimalHour = parseInt(optimalTimeSlot.split(':')[0]);

  // Create recommended time
  const recommendedTime = new Date(currentSchedule);
  recommendedTime.setHours(optimalHour, 0, 0, 0);

  // Check if current time is suboptimal
  if (currentScore < 70) {
    improvements.push(`Consider posting at ${optimalTimeSlot} instead for ${scorePostingTime(optimalTimeSlot, dayOfWeek).toFixed(0)}% better performance`);
  }

  // Check day optimization
  if (dayOfWeek === 'Tuesday') {
    improvements.push('⚠️ Tuesday has lowest performance (136 avg views). Consider rescheduling to Saturday/Sunday');
  }

  // Check caption if provided
  if (caption) {
    const captionAnalysis = analyzeCaptionQuality(caption);
    if (captionAnalysis.score < 70) {
      improvements.push(...captionAnalysis.suggestions);
    }
  }

  return {
    recommendedTime,
    score: currentScore,
    improvements,
  };
}

/**
 * Get real-time optimization suggestions for active workflow
 */
export function getWorkflowOptimizations(workflow: {
  scheduledTime: string;
  script?: string;
  caption?: string;
  platforms?: string[];
  contentType?: string;
}): {
  scheduleSuggestion?: string;
  platformSuggestions?: string[];
  captionImprovements?: string[];
  expectedViews: number;
  confidenceLevel: 'high' | 'medium' | 'low';
} {
  const scheduledDate = new Date(workflow.scheduledTime);
  const optimization = optimizeSchedule(
    scheduledDate,
    workflow.contentType || 'viral',
    workflow.caption || workflow.script
  );

  const recommendedPlatforms = getPlatformRecommendations(workflow.contentType || 'viral');
  const captionAnalysis = workflow.caption
    ? analyzeCaptionQuality(workflow.caption)
    : workflow.script
    ? analyzeCaptionQuality(workflow.script)
    : null;

  // Calculate expected views based on time slot and platforms
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][scheduledDate.getDay()];
  const dayData = PERFORMANCE_INSIGHTS.bestDays.find(d => d.day === dayOfWeek);
  const baseExpectedViews = dayData?.avgViews || 200;

  // Adjust for platform selection
  const youtubePriority = workflow.platforms?.includes('youtube') ? 1.5 : 0.5;
  const expectedViews = Math.round(baseExpectedViews * youtubePriority);

  return {
    scheduleSuggestion: optimization.improvements.length > 0 ? optimization.improvements[0] : undefined,
    platformSuggestions: recommendedPlatforms,
    captionImprovements: captionAnalysis?.suggestions,
    expectedViews,
    confidenceLevel: optimization.score >= 70 ? 'high' : optimization.score >= 50 ? 'medium' : 'low',
  };
}
