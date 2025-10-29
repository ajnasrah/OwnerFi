/**
 * OpenAI Budget Tracker
 *
 * Tracks OpenAI API token usage and costs to prevent runaway spending.
 * Implements daily and monthly budget limits with alerts.
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
  timestamp: number;
}

export interface BudgetLimit {
  daily: number;  // Daily budget in dollars
  monthly: number; // Monthly budget in dollars
}

// OpenAI pricing (as of 2024)
const PRICING = {
  'gpt-4o-mini': {
    input: 0.15 / 1_000_000,  // $0.15 per 1M input tokens
    output: 0.60 / 1_000_000  // $0.60 per 1M output tokens
  },
  'gpt-4': {
    input: 30.00 / 1_000_000,  // $30.00 per 1M input tokens
    output: 60.00 / 1_000_000  // $60.00 per 1M output tokens
  }
};

// Default budget limits
const DEFAULT_LIMITS: BudgetLimit = {
  daily: 50,    // $50/day
  monthly: 1000 // $1000/month
};

/**
 * Estimate tokens for text (rough approximation: 4 chars = 1 token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost for token usage
 */
export function calculateCost(inputTokens: number, outputTokens: number, model: string = 'gpt-4o-mini'): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4o-mini'];
  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}

/**
 * Get current budget usage for today
 */
export async function getDailyUsage(): Promise<number> {
  if (!db) return 0;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const usageDoc = await getDoc(doc(db, 'openai_usage', `daily_${today}`));

  if (!usageDoc.exists()) return 0;

  return usageDoc.data()?.totalCost || 0;
}

/**
 * Get current budget usage for this month
 */
export async function getMonthlyUsage(): Promise<number> {
  if (!db) return 0;

  const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const usageDoc = await getDoc(doc(db, 'openai_usage', `monthly_${yearMonth}`));

  if (!usageDoc.exists()) return 0;

  return usageDoc.data()?.totalCost || 0;
}

/**
 * Check if we're within budget limits
 */
export async function checkBudget(
  estimatedCost: number,
  period: 'daily' | 'monthly' = 'daily',
  limits: BudgetLimit = DEFAULT_LIMITS
): Promise<{ allowed: boolean; reason?: string; currentUsage: number; limit: number }> {
  const currentUsage = period === 'daily'
    ? await getDailyUsage()
    : await getMonthlyUsage();

  const limit = period === 'daily' ? limits.daily : limits.monthly;
  const projectedUsage = currentUsage + estimatedCost;

  if (projectedUsage > limit) {
    return {
      allowed: false,
      reason: `${period === 'daily' ? 'Daily' : 'Monthly'} budget exceeded. Current: $${currentUsage.toFixed(2)}, Projected: $${projectedUsage.toFixed(2)}, Limit: $${limit}`,
      currentUsage,
      limit
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit
  };
}

/**
 * Track token usage and update budget
 */
export async function trackUsage(usage: TokenUsage): Promise<void> {
  if (!db) return;

  const today = new Date().toISOString().split('T')[0];
  const yearMonth = new Date().toISOString().slice(0, 7);

  // Update daily usage
  const dailyDocRef = doc(db, 'openai_usage', `daily_${today}`);
  const dailyDoc = await getDoc(dailyDocRef);

  if (dailyDoc.exists()) {
    const current = dailyDoc.data();
    await updateDoc(dailyDocRef, {
      inputTokens: (current.inputTokens || 0) + usage.inputTokens,
      outputTokens: (current.outputTokens || 0) + usage.outputTokens,
      totalTokens: (current.totalTokens || 0) + usage.totalTokens,
      totalCost: (current.totalCost || 0) + usage.estimatedCost,
      requestCount: (current.requestCount || 0) + 1,
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(dailyDocRef, {
      date: today,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      totalCost: usage.estimatedCost,
      requestCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Update monthly usage
  const monthlyDocRef = doc(db, 'openai_usage', `monthly_${yearMonth}`);
  const monthlyDoc = await getDoc(monthlyDocRef);

  if (monthlyDoc.exists()) {
    const current = monthlyDoc.data();
    await updateDoc(monthlyDocRef, {
      inputTokens: (current.inputTokens || 0) + usage.inputTokens,
      outputTokens: (current.outputTokens || 0) + usage.outputTokens,
      totalTokens: (current.totalTokens || 0) + usage.totalTokens,
      totalCost: (current.totalCost || 0) + usage.estimatedCost,
      requestCount: (current.requestCount || 0) + 1,
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(monthlyDocRef, {
      yearMonth,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      totalCost: usage.estimatedCost,
      requestCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Log warning if approaching limits
  const dailyUsage = await getDailyUsage();
  const monthlyUsage = await getMonthlyUsage();

  if (dailyUsage > DEFAULT_LIMITS.daily * 0.8) {
    console.warn(`⚠️  OpenAI daily budget at ${((dailyUsage / DEFAULT_LIMITS.daily) * 100).toFixed(1)}% ($${dailyUsage.toFixed(2)}/$${DEFAULT_LIMITS.daily})`);
  }

  if (monthlyUsage > DEFAULT_LIMITS.monthly * 0.8) {
    console.warn(`⚠️  OpenAI monthly budget at ${((monthlyUsage / DEFAULT_LIMITS.monthly) * 100).toFixed(1)}% ($${monthlyUsage.toFixed(2)}/$${DEFAULT_LIMITS.monthly})`);
  }
}

/**
 * Get budget summary
 */
export async function getBudgetSummary(): Promise<{
  daily: { usage: number; limit: number; percentage: number };
  monthly: { usage: number; limit: number; percentage: number };
}> {
  const dailyUsage = await getDailyUsage();
  const monthlyUsage = await getMonthlyUsage();

  return {
    daily: {
      usage: dailyUsage,
      limit: DEFAULT_LIMITS.daily,
      percentage: (dailyUsage / DEFAULT_LIMITS.daily) * 100
    },
    monthly: {
      usage: monthlyUsage,
      limit: DEFAULT_LIMITS.monthly,
      percentage: (monthlyUsage / DEFAULT_LIMITS.monthly) * 100
    }
  };
}
