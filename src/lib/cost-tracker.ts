/**
 * Cost Tracking & Budget Management System
 *
 * This module tracks API usage and costs across all services:
 * - HeyGen: $330/month for 660 credits ($0.50/credit)
 * - Submagic: $150/month for 600 credits ($0.25/credit)
 * - Late: $50/month unlimited (no per-unit cost)
 * - OpenAI: Variable ($0.15 per 1M input tokens, $0.60 per 1M output tokens)
 *
 * Features:
 * - Real-time cost tracking per brand
 * - Daily and monthly budget enforcement
 * - Automatic alerts at 80% and 95% thresholds
 * - Cost estimation before API calls
 * - Historical cost analytics
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, Timestamp, collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { costs, monitoring, features } from './env-config';
import { Brand } from '@/config/constants';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CostEntry {
  id: string;
  timestamp: number;
  brand: Brand;
  service: 'heygen' | 'submagic' | 'late' | 'openai' | 'r2';
  operation: string; // e.g., 'video_generation', 'caption_processing', 'post_to_social'
  units: number; // Credits or tokens used
  costUSD: number; // Actual cost in USD
  workflowId?: string;
  metadata?: Record<string, any>;
}

export interface DailyCosts {
  date: string; // YYYY-MM-DD
  brand: Brand;
  heygen: { units: number; costUSD: number };
  submagic: { units: number; costUSD: number };
  late: { units: number; costUSD: number };
  openai: { units: number; costUSD: number };
  r2: { units: number; costUSD: number };
  total: number;
  updatedAt: number;
}

export interface MonthlyCosts {
  month: string; // YYYY-MM
  brand: Brand;
  heygen: { units: number; costUSD: number };
  submagic: { units: number; costUSD: number };
  late: { units: number; costUSD: number };
  openai: { units: number; costUSD: number };
  r2: { units: number; costUSD: number };
  total: number;
  updatedAt: number;
}

export interface BudgetStatus {
  service: 'heygen' | 'submagic' | 'openai';
  period: 'daily' | 'monthly';
  used: number;
  limit: number;
  percentage: number;
  exceeded: boolean;
  nearLimit: boolean; // True if >= 80% of limit
}

// ============================================================================
// Cost Calculation Functions
// ============================================================================

/**
 * Calculate cost for HeyGen video generation
 * HeyGen charges 1 credit per video, $0.50 per credit
 */
export function calculateHeyGenCost(creditCount: number = 1): number {
  return creditCount * costs.costPerUnit.heygenCredit;
}

/**
 * Calculate cost for Submagic caption processing
 * Submagic charges 1 credit per video, $0.25 per credit
 */
export function calculateSubmagicCost(creditCount: number = 1): number {
  return creditCount * costs.costPerUnit.submagicCredit;
}

/**
 * Calculate cost for OpenAI API calls
 * Different rates for input vs output tokens
 */
export function calculateOpenAICost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * costs.costPerUnit.openaiGpt4oMiniInput;
  const outputCost = (outputTokens / 1_000_000) * costs.costPerUnit.openaiGpt4oMiniOutput;
  return inputCost + outputCost;
}

/**
 * Calculate cost for R2 storage (per GB/month)
 * Prorated daily: $0.015 / 30 days = $0.0005 per GB per day
 */
export function calculateR2Cost(gigabytes: number): number {
  return gigabytes * costs.costPerUnit.r2StoragePerGB;
}

/**
 * Late API has no per-unit cost ($50/month unlimited)
 */
export function calculateLateCost(): number {
  return 0; // Flat rate subscription, no per-unit cost
}

// ============================================================================
// Cost Tracking Functions
// ============================================================================

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Track a cost entry for a specific service
 */
export async function trackCost(
  brand: Brand,
  service: 'heygen' | 'submagic' | 'late' | 'openai' | 'r2',
  operation: string,
  units: number,
  costUSD: number,
  workflowId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const costEntry: CostEntry = {
      id: `${brand}_${service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      brand,
      service,
      operation,
      units,
      costUSD,
      workflowId,
      metadata,
    };

    // Save individual cost entry
    await setDoc(doc(db, 'cost_entries', costEntry.id), costEntry);

    // Update daily aggregates
    await updateDailyCosts(brand, service, units, costUSD);

    // Update monthly aggregates
    await updateMonthlyCosts(brand, service, units, costUSD);

    console.log(`💰 [COST] ${brand} - ${service}: $${costUSD.toFixed(4)} (${units} units)`);

  } catch (error) {
    console.error('❌ Error tracking cost:', error);
    // Don't throw - cost tracking failure shouldn't break workflows
  }
}

/**
 * Update daily cost aggregates
 */
async function updateDailyCosts(
  brand: Brand,
  service: 'heygen' | 'submagic' | 'late' | 'openai' | 'r2',
  units: number,
  costUSD: number
): Promise<void> {
  const date = getTodayDate();
  const docId = `${brand}_${date}`;
  const docRef = doc(db, 'daily_costs', docId);

  try {
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Create new daily document
      const dailyCosts: DailyCosts = {
        date,
        brand,
        heygen: { units: 0, costUSD: 0 },
        submagic: { units: 0, costUSD: 0 },
        late: { units: 0, costUSD: 0 },
        openai: { units: 0, costUSD: 0 },
        r2: { units: 0, costUSD: 0 },
        total: 0,
        updatedAt: Date.now(),
      };

      // Set the service cost
      dailyCosts[service] = { units, costUSD };
      dailyCosts.total = costUSD;

      await setDoc(docRef, dailyCosts);
    } else {
      // Update existing daily document
      await updateDoc(docRef, {
        [`${service}.units`]: increment(units),
        [`${service}.costUSD`]: increment(costUSD),
        total: increment(costUSD),
        updatedAt: Date.now(),
      });
    }
  } catch (error) {
    console.error('❌ Error updating daily costs:', error);
  }
}

/**
 * Update monthly cost aggregates
 */
async function updateMonthlyCosts(
  brand: Brand,
  service: 'heygen' | 'submagic' | 'late' | 'openai' | 'r2',
  units: number,
  costUSD: number
): Promise<void> {
  const month = getCurrentMonth();
  const docId = `${brand}_${month}`;
  const docRef = doc(db, 'monthly_costs', docId);

  try {
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Create new monthly document
      const monthlyCosts: MonthlyCosts = {
        month,
        brand,
        heygen: { units: 0, costUSD: 0 },
        submagic: { units: 0, costUSD: 0 },
        late: { units: 0, costUSD: 0 },
        openai: { units: 0, costUSD: 0 },
        r2: { units: 0, costUSD: 0 },
        total: 0,
        updatedAt: Date.now(),
      };

      // Set the service cost
      monthlyCosts[service] = { units, costUSD };
      monthlyCosts.total = costUSD;

      await setDoc(docRef, monthlyCosts);
    } else {
      // Update existing monthly document
      await updateDoc(docRef, {
        [`${service}.units`]: increment(units),
        [`${service}.costUSD`]: increment(costUSD),
        total: increment(costUSD),
        updatedAt: Date.now(),
      });
    }
  } catch (error) {
    console.error('❌ Error updating monthly costs:', error);
  }
}

// ============================================================================
// Budget Checking Functions
// ============================================================================

/**
 * Get daily costs for a specific brand and service
 */
export async function getDailyCosts(brand: Brand, date?: string): Promise<DailyCosts | null> {
  const targetDate = date || getTodayDate();
  const docId = `${brand}_${targetDate}`;

  try {
    const docSnap = await getDoc(doc(db, 'daily_costs', docId));
    return docSnap.exists() ? (docSnap.data() as DailyCosts) : null;
  } catch (error) {
    console.error('❌ Error getting daily costs:', error);
    return null;
  }
}

/**
 * Get monthly costs for a specific brand
 */
export async function getMonthlyCosts(brand: Brand, month?: string): Promise<MonthlyCosts | null> {
  const targetMonth = month || getCurrentMonth();
  const docId = `${brand}_${targetMonth}`;

  try {
    const docSnap = await getDoc(doc(db, 'monthly_costs', docId));
    return docSnap.exists() ? (docSnap.data() as MonthlyCosts) : null;
  } catch (error) {
    console.error('❌ Error getting monthly costs:', error);
    return null;
  }
}

/**
 * Get total daily costs across all brands
 */
export async function getTotalDailyCosts(date?: string): Promise<{ [brand: string]: DailyCosts }> {
  const targetDate = date || getTodayDate();

  try {
    const q = query(
      collection(db, 'daily_costs'),
      where('date', '==', targetDate)
    );

    const snapshot = await getDocs(q);
    const costs: { [brand: string]: DailyCosts } = {};

    snapshot.forEach((doc) => {
      const data = doc.data() as DailyCosts;
      costs[data.brand] = data;
    });

    return costs;
  } catch (error) {
    console.error('❌ Error getting total daily costs:', error);
    return {};
  }
}

/**
 * Get total monthly costs across all brands
 */
export async function getTotalMonthlyCosts(month?: string): Promise<{ [brand: string]: MonthlyCosts }> {
  const targetMonth = month || getCurrentMonth();

  try {
    const q = query(
      collection(db, 'monthly_costs'),
      where('month', '==', targetMonth)
    );

    const snapshot = await getDocs(q);
    const costs: { [brand: string]: MonthlyCosts } = {};

    snapshot.forEach((doc) => {
      const data = doc.data() as MonthlyCosts;
      costs[data.brand] = data;
    });

    return costs;
  } catch (error) {
    console.error('❌ Error getting total monthly costs:', error);
    return {};
  }
}

/**
 * Check if budget is exceeded for a specific service
 */
export async function checkBudget(
  service: 'heygen' | 'submagic' | 'openai',
  period: 'daily' | 'monthly' = 'daily'
): Promise<BudgetStatus> {
  // Get budget limit
  const limit = period === 'daily'
    ? costs.dailyBudget[service]
    : costs.monthlyBudget[service];

  // Get current usage across all brands
  const allCosts = period === 'daily'
    ? await getTotalDailyCosts()
    : await getTotalMonthlyCosts();

  // Sum up units for this service
  const used = Object.values(allCosts).reduce((sum, brandCosts) => {
    return sum + brandCosts[service].units;
  }, 0);

  const percentage = (used / limit) * 100;
  const exceeded = used >= limit;
  const nearLimit = percentage >= costs.alertThresholds.warning;

  return {
    service,
    period,
    used,
    limit,
    percentage,
    exceeded,
    nearLimit,
  };
}

/**
 * Check if budget allows for a new API call
 * Returns true if within budget, false if exceeded
 */
export async function canAfford(
  service: 'heygen' | 'submagic' | 'openai',
  units: number = 1
): Promise<{ allowed: boolean; reason?: string; status: BudgetStatus }> {
  // Check if budget enforcement is enabled
  if (!features.enforceBudgetCaps) {
    const status = await checkBudget(service, 'daily');
    return { allowed: true, reason: 'Budget enforcement disabled', status };
  }

  // Check daily budget
  const dailyStatus = await checkBudget(service, 'daily');

  if (dailyStatus.used + units > dailyStatus.limit) {
    return {
      allowed: false,
      reason: `Daily ${service} budget exceeded (${dailyStatus.used}/${dailyStatus.limit} units used)`,
      status: dailyStatus,
    };
  }

  // Check monthly budget
  const monthlyStatus = await checkBudget(service, 'monthly');

  if (monthlyStatus.used + units > monthlyStatus.limit) {
    return {
      allowed: false,
      reason: `Monthly ${service} budget exceeded (${monthlyStatus.used}/${monthlyStatus.limit} units used)`,
      status: monthlyStatus,
    };
  }

  return { allowed: true, status: dailyStatus };
}

// ============================================================================
// Alerting Functions
// ============================================================================

/**
 * Send budget alert to Slack
 */
export async function sendBudgetAlert(
  service: string,
  period: 'daily' | 'monthly',
  percentage: number,
  used: number,
  limit: number
): Promise<void> {
  if (!monitoring.slackWebhook) {
    console.warn('⚠️  Slack webhook not configured, skipping alert');
    return;
  }

  try {
    const emoji = percentage >= costs.alertThresholds.critical ? '🚨' : '⚠️';
    const severity = percentage >= costs.alertThresholds.critical ? 'CRITICAL' : 'WARNING';

    const message = {
      text: `${emoji} ${severity}: ${service.toUpperCase()} Budget Alert`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${severity}: ${service.toUpperCase()} Budget Alert`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Period:*\n${period}`,
            },
            {
              type: 'mrkdwn',
              text: `*Usage:*\n${percentage.toFixed(1)}% (${used}/${limit} units)`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: percentage >= costs.alertThresholds.critical
              ? '⛔ *Budget limit reached! No more API calls will be allowed today.*'
              : '⚠️ Approaching budget limit. Monitor usage carefully.',
          },
        },
      ],
    };

    const response = await fetch(monitoring.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Failed to send Slack alert:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error sending budget alert:', error);
  }
}

/**
 * Check budget and send alerts if thresholds are exceeded
 */
export async function checkAndAlert(
  service: 'heygen' | 'submagic' | 'openai',
  period: 'daily' | 'monthly' = 'daily'
): Promise<void> {
  const status = await checkBudget(service, period);

  // Send alert if near limit or exceeded
  if (status.nearLimit || status.exceeded) {
    await sendBudgetAlert(service, period, status.percentage, status.used, status.limit);
  }
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Get cost history for a date range
 */
export async function getCostHistory(
  brand: Brand,
  startDate: string,
  endDate: string
): Promise<DailyCosts[]> {
  try {
    const q = query(
      collection(db, 'daily_costs'),
      where('brand', '==', brand),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as DailyCosts);
  } catch (error) {
    console.error('❌ Error getting cost history:', error);
    return [];
  }
}

/**
 * Get recent cost entries for audit trail
 */
export async function getRecentCostEntries(limitCount: number = 100): Promise<CostEntry[]> {
  try {
    const q = query(
      collection(db, 'cost_entries'),
      orderBy('timestamp', 'desc'),
      firestoreLimit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as CostEntry);
  } catch (error) {
    console.error('❌ Error getting recent cost entries:', error);
    return [];
  }
}

/**
 * Get cost breakdown by service for the current month
 */
export async function getMonthlyBreakdown(): Promise<{
  byBrand: { [brand: string]: MonthlyCosts };
  byService: { [service: string]: { units: number; costUSD: number } };
  total: number;
}> {
  const allCosts = await getTotalMonthlyCosts();

  const byService: { [service: string]: { units: number; costUSD: number } } = {
    heygen: { units: 0, costUSD: 0 },
    submagic: { units: 0, costUSD: 0 },
    late: { units: 0, costUSD: 0 },
    openai: { units: 0, costUSD: 0 },
    r2: { units: 0, costUSD: 0 },
  };

  let total = 0;

  Object.values(allCosts).forEach((brandCosts) => {
    byService.heygen.units += brandCosts.heygen.units;
    byService.heygen.costUSD += brandCosts.heygen.costUSD;

    byService.submagic.units += brandCosts.submagic.units;
    byService.submagic.costUSD += brandCosts.submagic.costUSD;

    byService.late.units += brandCosts.late.units;
    byService.late.costUSD += brandCosts.late.costUSD;

    byService.openai.units += brandCosts.openai.units;
    byService.openai.costUSD += brandCosts.openai.costUSD;

    byService.r2.units += brandCosts.r2.units;
    byService.r2.costUSD += brandCosts.r2.costUSD;

    total += brandCosts.total;
  });

  return {
    byBrand: allCosts,
    byService,
    total,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Calculation
  calculateHeyGenCost,
  calculateSubmagicCost,
  calculateOpenAICost,
  calculateR2Cost,
  calculateLateCost,

  // Tracking
  trackCost,

  // Budget checking
  checkBudget,
  canAfford,
  getDailyCosts,
  getMonthlyCosts,
  getTotalDailyCosts,
  getTotalMonthlyCosts,

  // Alerting
  sendBudgetAlert,
  checkAndAlert,

  // Analytics
  getCostHistory,
  getRecentCostEntries,
  getMonthlyBreakdown,
};
