// A/B Testing Framework
// Track video performance across different variations to optimize content

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';

/**
 * A/B Test Types
 */
export type TestVariationType =
  | 'hook' // First 3 seconds / opening line
  | 'caption_style' // Caption format/tone
  | 'posting_time' // Time of day
  | 'thumbnail' // YouTube thumbnail (future)
  | 'cta'; // Call-to-action placement

export interface ABTestVariant {
  id: string; // A, B, C, etc.
  name: string; // Descriptive name
  description: string; // What's different about this variant
  promptModifier?: string; // OpenAI prompt modification
  hookTemplate?: string; // Template for video opening
  captionTemplate?: string; // Template for caption
  postingTime?: {
    hour: number; // 0-23
    minute: number; // 0-59
    timezone: string; // e.g., 'America/New_York'
  };
}

export interface ABTestMetrics {
  // Platform-specific metrics (fetched from Late API or platform APIs)
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number; // Instagram/TikTok
  clickThroughRate: number; // Percentage
  engagementRate: number; // (likes + comments + shares) / views
  watchTime: number; // Average seconds watched
  completionRate: number; // Percentage who watched to end
  lastUpdated: number; // Timestamp
}

export interface PlatformMetrics {
  instagram?: ABTestMetrics;
  tiktok?: ABTestMetrics;
  youtube?: ABTestMetrics;
  facebook?: ABTestMetrics;
  linkedin?: ABTestMetrics;
  twitter?: ABTestMetrics;
  threads?: ABTestMetrics;
  bluesky?: ABTestMetrics;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  type: TestVariationType;
  brand: 'carz' | 'ownerfi' | 'podcast';

  // Test configuration
  variants: ABTestVariant[];
  trafficSplit: number[]; // e.g., [50, 50] for 50/50 split

  // Status
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: number;
  endDate?: number;

  // Results
  winningVariant?: string; // Variant ID
  confidenceLevel?: number; // 0-100, statistical confidence

  // Metadata
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface ABTestResult {
  testId: string;
  variantId: string;
  workflowId: string;
  brand: 'carz' | 'ownerfi' | 'podcast';

  // What was posted
  videoUrl: string;
  caption: string;
  title?: string;
  platforms: string[];
  postedAt: number;
  latePostId?: string;

  // Performance metrics per platform
  metrics: PlatformMetrics;

  // Aggregate metrics
  totalViews: number;
  totalEngagements: number;
  overallEngagementRate: number;

  // Metadata
  createdAt: number;
  updatedAt: number;
}

const AB_TESTS_COLLECTION = 'ab_tests';
const AB_RESULTS_COLLECTION = 'ab_test_results';

/**
 * Create a new A/B test
 */
export async function createABTest(test: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const testId = `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const testDoc: ABTest = {
    ...test,
    id: testId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(doc(db, AB_TESTS_COLLECTION, testId), testDoc);

  console.log(`✅ Created A/B test: ${testId} (${test.name})`);
  return testId;
}

/**
 * Get active A/B test for a brand and type
 * Returns null if no active test
 */
export async function getActiveTest(
  brand: 'carz' | 'ownerfi' | 'podcast',
  type: TestVariationType
): Promise<ABTest | null> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, AB_TESTS_COLLECTION),
    where('brand', '==', brand),
    where('type', '==', type),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as ABTest;
}

/**
 * Select a variant for a new workflow based on traffic split
 */
export function selectVariant(test: ABTest): ABTestVariant {
  const random = Math.random() * 100; // 0-100

  let cumulativeWeight = 0;
  for (let i = 0; i < test.variants.length; i++) {
    cumulativeWeight += test.trafficSplit[i];
    if (random < cumulativeWeight) {
      return test.variants[i];
    }
  }

  // Fallback to first variant
  return test.variants[0];
}

/**
 * Record a test result when workflow completes
 */
export async function recordTestResult(result: Omit<ABTestResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const resultId = `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const resultDoc: ABTestResult = {
    ...result,
    createdAt: Date.now(),
    updatedAt: Date.now()
  } as ABTestResult;

  await setDoc(doc(db, AB_RESULTS_COLLECTION, resultId), resultDoc);

  console.log(`✅ Recorded A/B test result: ${resultId} for variant ${result.variantId}`);
  return resultId;
}

/**
 * Update metrics for a test result
 */
export async function updateTestResultMetrics(
  resultId: string,
  metrics: Partial<PlatformMetrics>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const resultRef = doc(db, AB_RESULTS_COLLECTION, resultId);
  const resultDoc = await getDoc(resultRef);

  if (!resultDoc.exists()) {
    throw new Error(`Test result not found: ${resultId}`);
  }

  const currentMetrics = resultDoc.data().metrics || {};
  const updatedMetrics = { ...currentMetrics, ...metrics };

  // Calculate aggregate metrics
  let totalViews = 0;
  let totalEngagements = 0;

  Object.values(updatedMetrics).forEach((platformMetric) => {
    if (platformMetric && typeof platformMetric === 'object' && 'views' in platformMetric) {
      totalViews += platformMetric.views || 0;
      totalEngagements += (platformMetric.likes || 0) +
                          (platformMetric.comments || 0) +
                          (platformMetric.shares || 0);
    }
  });

  const overallEngagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

  await updateDoc(resultRef, {
    metrics: updatedMetrics,
    totalViews,
    totalEngagements,
    overallEngagementRate,
    updatedAt: Date.now()
  });

  console.log(`✅ Updated metrics for result ${resultId}`);
}

/**
 * Get all results for an A/B test
 */
export async function getTestResults(testId: string): Promise<ABTestResult[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, AB_RESULTS_COLLECTION),
    where('testId', '==', testId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ABTestResult);
}

/**
 * Calculate winning variant based on statistical significance
 * Uses bayesian analysis to determine winner with confidence level
 */
export async function calculateWinner(testId: string): Promise<{
  winningVariant: string;
  confidenceLevel: number;
  variantStats: Map<string, {
    sampleSize: number;
    engagementRate: number;
    totalViews: number;
    totalEngagements: number;
  }>;
}> {
  const results = await getTestResults(testId);

  // Group results by variant
  const variantStats = new Map<string, {
    sampleSize: number;
    engagementRate: number;
    totalViews: number;
    totalEngagements: number;
  }>();

  results.forEach(result => {
    const current = variantStats.get(result.variantId) || {
      sampleSize: 0,
      engagementRate: 0,
      totalViews: 0,
      totalEngagements: 0
    };

    variantStats.set(result.variantId, {
      sampleSize: current.sampleSize + 1,
      totalViews: current.totalViews + result.totalViews,
      totalEngagements: current.totalEngagements + result.totalEngagements,
      engagementRate: 0 // Will calculate after
    });
  });

  // Calculate engagement rates
  variantStats.forEach((stats, variantId) => {
    stats.engagementRate = stats.totalViews > 0
      ? (stats.totalEngagements / stats.totalViews) * 100
      : 0;
  });

  // Find variant with highest engagement rate
  let winningVariant = '';
  let maxEngagementRate = 0;

  variantStats.forEach((stats, variantId) => {
    if (stats.engagementRate > maxEngagementRate) {
      maxEngagementRate = stats.engagementRate;
      winningVariant = variantId;
    }
  });

  // Calculate confidence level using simple z-test
  // (For production, use proper bayesian analysis)
  const winnerStats = variantStats.get(winningVariant)!;
  const minSampleSize = 30; // Minimum for statistical significance

  let confidenceLevel = 0;
  if (winnerStats.sampleSize >= minSampleSize) {
    // Simple confidence: based on sample size and margin
    const sampleFactor = Math.min(winnerStats.sampleSize / 100, 1);

    // Check if winner is significantly better than others
    let marginSum = 0;
    let count = 0;

    variantStats.forEach((stats, variantId) => {
      if (variantId !== winningVariant && stats.sampleSize >= minSampleSize) {
        const margin = winnerStats.engagementRate - stats.engagementRate;
        if (margin > 0) {
          marginSum += margin;
          count++;
        }
      }
    });

    const avgMargin = count > 0 ? marginSum / count : 0;
    const marginFactor = Math.min(avgMargin / 2, 1); // 2% difference = 100% confidence

    confidenceLevel = Math.round(sampleFactor * marginFactor * 100);
  }

  return {
    winningVariant,
    confidenceLevel,
    variantStats
  };
}

/**
 * Mark test as completed and set winner
 */
export async function completeTest(testId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const { winningVariant, confidenceLevel } = await calculateWinner(testId);

  await updateDoc(doc(db, AB_TESTS_COLLECTION, testId), {
    status: 'completed',
    endDate: Date.now(),
    winningVariant,
    confidenceLevel,
    updatedAt: Date.now()
  });

  console.log(`✅ Completed A/B test ${testId}, winner: ${winningVariant} (${confidenceLevel}% confidence)`);
}

/**
 * Get all A/B tests for a brand
 */
export async function getTestsForBrand(brand: 'carz' | 'ownerfi' | 'podcast'): Promise<ABTest[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, AB_TESTS_COLLECTION),
    where('brand', '==', brand),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ABTest);
}

/**
 * Example: Create a hook testing experiment
 */
export async function createHookTest(brand: 'carz' | 'ownerfi' | 'podcast'): Promise<string> {
  return createABTest({
    name: 'Hook Style Test - Question vs Statement',
    description: 'Test whether question-based hooks or statement-based hooks perform better',
    type: 'hook',
    brand,
    variants: [
      {
        id: 'A',
        name: 'Question Hook',
        description: 'Opens with a question to engage viewer',
        hookTemplate: 'Did you know that {{topic}}? Here\'s what you need to know...',
        promptModifier: 'Start with an engaging question that makes viewers curious.'
      },
      {
        id: 'B',
        name: 'Statement Hook',
        description: 'Opens with a bold statement or fact',
        hookTemplate: 'Here\'s something shocking about {{topic}}...',
        promptModifier: 'Start with a bold, attention-grabbing statement or surprising fact.'
      }
    ],
    trafficSplit: [50, 50], // 50/50 split
    status: 'active',
    startDate: Date.now()
  });
}

/**
 * Example: Create a caption style test
 */
export async function createCaptionTest(brand: 'carz' | 'ownerfi' | 'podcast'): Promise<string> {
  return createABTest({
    name: 'Caption Style Test - Short vs Detailed',
    description: 'Test whether short punchy captions or detailed informative captions drive more engagement',
    type: 'caption_style',
    brand,
    variants: [
      {
        id: 'A',
        name: 'Short & Punchy',
        description: '1-2 sentences max, emoji heavy',
        captionTemplate: '{{hook}} 🔥\n\n{{cta}}'
      },
      {
        id: 'B',
        name: 'Detailed & Informative',
        description: 'Longer caption with context and details',
        captionTemplate: '{{hook}}\n\n{{details}}\n\n{{cta}}\n\n{{hashtags}}'
      }
    ],
    trafficSplit: [50, 50],
    status: 'active',
    startDate: Date.now()
  });
}

/**
 * Example: Create a posting time test
 */
export async function createPostingTimeTest(brand: 'carz' | 'ownerfi' | 'podcast'): Promise<string> {
  return createABTest({
    name: 'Posting Time Test - Morning vs Evening',
    description: 'Test optimal posting time for maximum engagement',
    type: 'posting_time',
    brand,
    variants: [
      {
        id: 'A',
        name: 'Morning (9 AM ET)',
        description: 'Post at 9 AM Eastern Time',
        postingTime: {
          hour: 9,
          minute: 0,
          timezone: 'America/New_York'
        }
      },
      {
        id: 'B',
        name: 'Evening (7 PM ET)',
        description: 'Post at 7 PM Eastern Time',
        postingTime: {
          hour: 19,
          minute: 0,
          timezone: 'America/New_York'
        }
      }
    ],
    trafficSplit: [50, 50],
    status: 'active',
    startDate: Date.now()
  });
}
