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
import { costs } from '@/lib/env-config';

export async function GET() {
  try {
    // Fetch all cost data in parallel
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
      getTotalDailyCosts(),
      getTotalMonthlyCosts(),
      getMonthlyBreakdown(),
      checkBudget('heygen', 'daily'),
      checkBudget('submagic', 'daily'),
      checkBudget('openai', 'daily'),
      getHeyGenQuota().catch(() => ({ remaining_quota: 0, remainingCredits: 0 })),
      getRecentCostEntries(50),
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
