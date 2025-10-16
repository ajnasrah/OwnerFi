// A/B Testing Integration with Workflow System
// Automatically tracks test results when workflows complete

import {
  getActiveTest,
  selectVariant,
  recordTestResult,
  type ABTestVariant,
  type ABTest
} from './ab-testing';
import type { WorkflowQueueItem } from './feed-store-firestore';

/**
 * Check for active A/B tests and select a variant for a new workflow
 * Called when workflow is created
 */
export async function assignABTestVariant(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowData: Partial<WorkflowQueueItem>
): Promise<{
  abTestId?: string;
  abTestVariantId?: string;
  variant?: ABTestVariant;
  test?: ABTest;
}> {
  try {
    // Check for active hook test
    const hookTest = await getActiveTest(brand, 'hook');

    if (hookTest) {
      const variant = selectVariant(hookTest);

      console.log(`🎯 A/B Test: Assigned variant ${variant.id} (${variant.name}) to workflow`);

      return {
        abTestId: hookTest.id,
        abTestVariantId: variant.id,
        variant,
        test: hookTest
      };
    }

    // Check for active caption test
    const captionTest = await getActiveTest(brand, 'caption_style');

    if (captionTest) {
      const variant = selectVariant(captionTest);

      console.log(`🎯 A/B Test: Assigned caption variant ${variant.id} (${variant.name}) to workflow`);

      return {
        abTestId: captionTest.id,
        abTestVariantId: variant.id,
        variant,
        test: captionTest
      };
    }

    // Check for active posting time test
    const timeTest = await getActiveTest(brand, 'posting_time');

    if (timeTest) {
      const variant = selectVariant(timeTest);

      console.log(`🎯 A/B Test: Assigned posting time variant ${variant.id} (${variant.name}) to workflow`);

      return {
        abTestId: timeTest.id,
        abTestVariantId: variant.id,
        variant,
        test: timeTest
      };
    }

    // No active tests
    return {};

  } catch (error) {
    console.error('❌ Error assigning A/B test variant:', error);
    return {};
  }
}

/**
 * Apply variant modifications to OpenAI prompt
 * Called during script generation
 */
export function applyVariantToPrompt(
  basePrompt: string,
  variant?: ABTestVariant
): string {
  if (!variant || !variant.promptModifier) {
    return basePrompt;
  }

  // Inject variant's prompt modifier at the beginning
  return `${variant.promptModifier}\n\n${basePrompt}`;
}

/**
 * Apply variant modifications to caption
 * Called when generating caption
 */
export function applyVariantToCaption(
  baseCaption: string,
  variant?: ABTestVariant,
  context?: {
    hook?: string;
    details?: string;
    cta?: string;
    hashtags?: string;
  }
): string {
  if (!variant || !variant.captionTemplate) {
    return baseCaption;
  }

  // Replace template variables
  let caption = variant.captionTemplate;

  if (context) {
    caption = caption
      .replace('{{hook}}', context.hook || '')
      .replace('{{details}}', context.details || '')
      .replace('{{cta}}', context.cta || '')
      .replace('{{hashtags}}', context.hashtags || '');
  }

  // Clean up extra whitespace
  caption = caption.replace(/\n\n\n+/g, '\n\n').trim();

  return caption || baseCaption;
}

/**
 * Get posting time from variant
 * Called when scheduling post
 */
export function getVariantPostingTime(variant?: ABTestVariant): Date | undefined {
  if (!variant || !variant.postingTime) {
    return undefined;
  }

  const { hour, minute, timezone } = variant.postingTime;

  // Create date in specified timezone
  const now = new Date();
  const targetDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

  targetDate.setHours(hour, minute, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (targetDate.getTime() < now.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

/**
 * Record test result when workflow completes successfully
 * Called from webhook handler when video is posted
 */
export async function recordWorkflowTestResult(
  workflow: WorkflowQueueItem
): Promise<string | null> {
  // Only record if workflow has A/B test assigned
  if (!workflow.abTestId || !workflow.abTestVariantId) {
    return null;
  }

  try {
    console.log(`📊 Recording A/B test result for workflow ${workflow.id}`);

    const resultId = await recordTestResult({
      testId: workflow.abTestId,
      variantId: workflow.abTestVariantId,
      workflowId: workflow.id,
      brand: workflow.brand,

      // Video details
      videoUrl: workflow.finalVideoUrl || '',
      caption: workflow.caption || '',
      title: workflow.title,
      platforms: workflow.platforms || [],
      postedAt: workflow.completedAt || Date.now(),
      latePostId: workflow.latePostId,

      // Metrics (will be populated later by cron)
      metrics: {},
      totalViews: 0,
      totalEngagements: 0,
      overallEngagementRate: 0
    });

    console.log(`✅ Recorded A/B test result: ${resultId}`);
    return resultId;

  } catch (error) {
    console.error('❌ Error recording A/B test result:', error);
    return null;
  }
}

/**
 * Fetch metrics from Late API for an A/B test result
 * Called by cron job periodically
 */
export async function fetchMetricsForResult(
  resultId: string,
  latePostId: string
): Promise<boolean> {
  try {
    // TODO: Implement Late API metrics fetching
    // This would call Late API to get views, likes, comments, shares per platform

    console.log(`📊 Fetching metrics for result ${resultId} (Late post ${latePostId})`);

    // For now, just log that we would fetch metrics
    // In production, you'd call:
    // const metrics = await getLatePostMetrics(latePostId);
    // await updateTestResultMetrics(resultId, metrics);

    return true;

  } catch (error) {
    console.error(`❌ Error fetching metrics for result ${resultId}:`, error);
    return false;
  }
}
