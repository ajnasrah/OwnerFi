/**
 * Cost Dashboard API
 * Returns real-time cost data for the admin dashboard
 */

import { NextResponse } from 'next/server';
import {
  getTotalDailyCosts,
  getTotalMonthlyCosts,
  getMonthlyBreakdown,
  checkBudget,
  getRecentCostEntries,
} from '@/lib/cost-tracker';
import { getHeyGenQuota } from '@/lib/heygen-client';
import { db } from '@/lib/firebase';

// Import costs safely - if env-config throws, catch it
let costs: any;
try {
  costs = require('@/lib/env-config').costs;
} catch (error) {
  console.error('Failed to load costs config:', error);
  // Provide fallback costs
  costs = {
    dailyBudget: { heygen: 100, submagic: 50, openai: 50 },
    monthlyBudget: { total: 700 },
    costPerUnit: {},
    alertThresholds: {}
  };
}

export async function GET() {
  try {
    // Check if Firebase is initialized
    if (!db) {
      console.error('❌ Firebase not initialized in cost dashboard API');
      return NextResponse.json(
        {
          success: false,
          error: 'Firebase not initialized - check environment variables',
          hint: 'Ensure NEXT_PUBLIC_FIREBASE_* environment variables are set'
        },
        { status: 500 }
      );
    }

    // Log initialization
    console.log('📊 Cost Dashboard API called');
    console.log('Cost config available:', !!costs);
    console.log('Daily budget:', costs?.dailyBudget);

    // Fetch all cost data in parallel with detailed error logging
    const [
      dailyCosts,
      monthlyCosts,
      monthlyBreakdown,
      heygenBudget,
      submagicBudget,
      openaiBudget,
      heygenQuota,
      recentEntries,
    ] = await Promise.all([
      getTotalDailyCosts().catch((err) => { console.error('getTotalDailyCosts error:', err); return {}; }),
      getTotalMonthlyCosts().catch((err) => { console.error('getTotalMonthlyCosts error:', err); return {}; }),
      getMonthlyBreakdown().catch((err) => { console.error('getMonthlyBreakdown error:', err); return { byBrand: {}, byService: { heygen: { units: 0, costUSD: 0 }, submagic: { units: 0, costUSD: 0 }, late: { units: 0, costUSD: 0 }, openai: { units: 0, costUSD: 0 }, r2: { units: 0, costUSD: 0 } }, total: 0 }; }),
      checkBudget('heygen', 'daily').catch((err) => { console.error('checkBudget heygen error:', err); return { service: 'heygen' as const, period: 'daily' as const, used: 0, limit: costs.dailyBudget.heygen, percentage: 0, exceeded: false, nearLimit: false }; }),
      checkBudget('submagic', 'daily').catch((err) => { console.error('checkBudget submagic error:', err); return { service: 'submagic' as const, period: 'daily' as const, used: 0, limit: costs.dailyBudget.submagic, percentage: 0, exceeded: false, nearLimit: false }; }),
      checkBudget('openai', 'daily').catch((err) => { console.error('checkBudget openai error:', err); return { service: 'openai' as const, period: 'daily' as const, used: 0, limit: costs.dailyBudget.openai, percentage: 0, exceeded: false, nearLimit: false }; }),
      getHeyGenQuota().catch((err) => { console.error('getHeyGenQuota error:', err); return { remaining_quota: 0, remainingCredits: 0 }; }),
      getRecentCostEntries(50).catch((err) => { console.error('getRecentCostEntries error:', err); return []; }),
    ]);

    // Calculate totals
    const totalDailySpend = Object.values(dailyCosts).reduce((sum, costs) => sum + costs.total, 0);
    const totalMonthlySpend = Object.values(monthlyCosts).reduce((sum, costs) => sum + costs.total, 0);

    // Get monthly budgets
    const monthlyBudgets = costs.monthlyBudget;
    const monthlyPercentage = (totalMonthlySpend / monthlyBudgets.total) * 100;

    // Build response
    const response = {
      success: true,
      timestamp: Date.now(),

      // Summary
      summary: {
        todaySpend: totalDailySpend,
        monthSpend: totalMonthlySpend,
        monthBudget: monthlyBudgets.total,
        monthPercentage: monthlyPercentage,
        daysLeftInMonth: getDaysLeftInMonth(),
        projectedMonthlySpend: projectMonthlySpend(totalMonthlySpend),
      },

      // Daily costs by brand
      dailyCosts,

      // Monthly costs by brand
      monthlyCosts,

      // Breakdown by service
      breakdown: monthlyBreakdown,

      // Budget status
      budgets: {
        heygen: {
          ...heygenBudget,
          accountQuota: {
            remaining: heygenQuota.remainingCredits,
            total: 660, // Monthly allocation
            percentage: (heygenQuota.remainingCredits / 660) * 100,
          },
        },
        submagic: {
          ...submagicBudget,
          accountQuota: {
            remaining: 600 - submagicBudget.used, // Estimated
            total: 600,
            percentage: ((600 - submagicBudget.used) / 600) * 100,
          },
        },
        openai: openaiBudget,
      },

      // Recent cost entries (for activity log)
      recentActivity: recentEntries.slice(0, 20),

      // Cost configuration
      config: {
        dailyLimits: costs.dailyBudget,
        monthlyLimits: costs.monthlyBudget,
        costPerUnit: costs.costPerUnit,
        alertThresholds: costs.alertThresholds,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error fetching cost dashboard data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get days left in current month
 */
function getDaysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

/**
 * Project monthly spend based on current usage
 */
function projectMonthlySpend(currentSpend: number): number {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const avgDailySpend = currentSpend / dayOfMonth;
  return avgDailySpend * daysInMonth;
}
