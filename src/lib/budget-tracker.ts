/**
 * Budget Tracking and Enforcement System
 * 
 * Tracks spending across video generation services and enforces limits
 * Prevents overspending and provides budget visibility
 */

import { db } from './firebase-admin';
import { Brand } from '@/config/constants';

export interface ServiceCost {
  service: 'creatify' | 'heygen' | 'synthesia' | 'submagic' | 'openai';
  amount: number;
  currency: 'USD';
  unit: 'video' | 'scene' | 'minute' | 'token' | 'export';
  quantity: number;
  metadata?: Record<string, any>;
}

export interface BudgetPeriod {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string; // YYYY-MM-DD
  endDate: string;
  brand: Brand;
  service: string;
  budgetLimit: number;
  spent: number;
  remaining: number;
  transactions: number;
  lastUpdated: number;
  alerts?: {
    warning75?: boolean;
    warning90?: boolean;
    limitExceeded?: boolean;
  };
}

export interface BudgetLimits {
  daily: { [service: string]: number };
  weekly: { [service: string]: number };
  monthly: { [service: string]: number };
}

export class BudgetTracker {
  private static readonly DEFAULT_LIMITS: BudgetLimits = {
    daily: {
      creatify: 50,   // $50/day
      heygen: 25,     // $25/day  
      synthesia: 30,  // $30/day
      submagic: 20,   // $20/day
      openai: 10      // $10/day
    },
    weekly: {
      creatify: 300,
      heygen: 150,
      synthesia: 180,
      submagic: 120,
      openai: 60
    },
    monthly: {
      creatify: 1200,
      heygen: 600,
      synthesia: 720,
      submagic: 480,
      openai: 240
    }
  };

  /**
   * Record a cost transaction
   */
  static async recordCost(
    brand: Brand,
    cost: ServiceCost,
    workflowId?: string
  ): Promise<{ success: boolean; warnings?: string[] }> {
    const warnings: string[] = [];
    
    try {
      const transaction = {
        id: `${cost.service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        brand,
        service: cost.service,
        amount: cost.amount,
        currency: cost.currency,
        unit: cost.unit,
        quantity: cost.quantity,
        workflowId,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        metadata: cost.metadata || {}
      };

      // Store transaction
      await db.collection('budget_transactions').doc(transaction.id).set(transaction);

      // Update budget periods
      const periods = ['daily', 'weekly', 'monthly'] as const;
      
      for (const period of periods) {
        const budgetPeriod = await this.getBudgetPeriod(brand, cost.service, period);
        const newSpent = budgetPeriod.spent + cost.amount;
        
        await this.updateBudgetPeriod(budgetPeriod.id, {
          spent: newSpent,
          remaining: budgetPeriod.budgetLimit - newSpent,
          transactions: budgetPeriod.transactions + 1,
          lastUpdated: Date.now()
        });

        // Check for budget alerts
        const warningsForPeriod = await this.checkBudgetAlerts(budgetPeriod, newSpent);
        warnings.push(...warningsForPeriod);
      }

      return { success: true, warnings: warnings.length > 0 ? warnings : undefined };

    } catch (error) {
      console.error('[Budget Tracker] Failed to record cost:', error);
      return { success: false };
    }
  }

  /**
   * Check if spending is allowed for a service
   */
  static async canSpend(
    brand: Brand,
    service: string,
    amount: number
  ): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    try {
      // Check daily limit first (most restrictive)
      const dailyBudget = await this.getBudgetPeriod(brand, service, 'daily');
      
      if (dailyBudget.remaining < amount) {
        return {
          allowed: false,
          reason: `Daily budget exceeded. Remaining: $${dailyBudget.remaining.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
          remaining: dailyBudget.remaining
        };
      }

      // Check weekly limit
      const weeklyBudget = await this.getBudgetPeriod(brand, service, 'weekly');
      
      if (weeklyBudget.remaining < amount) {
        return {
          allowed: false,
          reason: `Weekly budget exceeded. Remaining: $${weeklyBudget.remaining.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
          remaining: weeklyBudget.remaining
        };
      }

      // Check monthly limit
      const monthlyBudget = await this.getBudgetPeriod(brand, service, 'monthly');
      
      if (monthlyBudget.remaining < amount) {
        return {
          allowed: false,
          reason: `Monthly budget exceeded. Remaining: $${monthlyBudget.remaining.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
          remaining: monthlyBudget.remaining
        };
      }

      return {
        allowed: true,
        remaining: Math.min(dailyBudget.remaining, weeklyBudget.remaining, monthlyBudget.remaining)
      };

    } catch (error) {
      console.error('[Budget Tracker] Budget check failed:', error);
      // Fail open in case of errors
      return { allowed: true };
    }
  }

  /**
   * Get or create budget period
   */
  private static async getBudgetPeriod(
    brand: Brand,
    service: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<BudgetPeriod> {
    const { startDate, endDate } = this.getPeriodDates(period);
    const periodId = `${brand}_${service}_${period}_${startDate}`;
    
    const doc = await db.collection('budget_periods').doc(periodId).get();
    
    if (doc.exists()) {
      return { id: periodId, ...doc.data() } as BudgetPeriod;
    }

    // Create new budget period
    const budgetLimit = this.getBudgetLimit(service, period);
    const newPeriod: BudgetPeriod = {
      id: periodId,
      period,
      startDate,
      endDate,
      brand,
      service,
      budgetLimit,
      spent: 0,
      remaining: budgetLimit,
      transactions: 0,
      lastUpdated: Date.now()
    };

    await db.collection('budget_periods').doc(periodId).set(newPeriod);
    return newPeriod;
  }

  /**
   * Update budget period
   */
  private static async updateBudgetPeriod(
    periodId: string,
    updates: Partial<BudgetPeriod>
  ): Promise<void> {
    await db.collection('budget_periods').doc(periodId).update(updates);
  }

  /**
   * Get period date range
   */
  private static getPeriodDates(period: 'daily' | 'weekly' | 'monthly'): { startDate: string; endDate: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'daily':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
        
      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Sunday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0]
        };
        
      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          startDate: monthStart.toISOString().split('T')[0],
          endDate: monthEnd.toISOString().split('T')[0]
        };
    }
  }

  /**
   * Get budget limit for service and period
   */
  private static getBudgetLimit(service: string, period: 'daily' | 'weekly' | 'monthly'): number {
    const envKey = `BUDGET_${period.toUpperCase()}_${service.toUpperCase()}`;
    const envValue = process.env[envKey];
    
    if (envValue) {
      const parsed = parseFloat(envValue);
      if (!isNaN(parsed)) return parsed;
    }

    return this.DEFAULT_LIMITS[period][service] || 0;
  }

  /**
   * Check for budget alerts
   */
  private static async checkBudgetAlerts(
    budgetPeriod: BudgetPeriod,
    newSpent: number
  ): Promise<string[]> {
    const warnings: string[] = [];
    const percentageUsed = (newSpent / budgetPeriod.budgetLimit) * 100;

    // 75% warning
    if (percentageUsed >= 75 && !budgetPeriod.alerts?.warning75) {
      warnings.push(`⚠️ 75% of ${budgetPeriod.period} budget used for ${budgetPeriod.service} (${budgetPeriod.brand})`);
      await this.updateBudgetPeriod(budgetPeriod.id, {
        'alerts.warning75': true
      });
    }

    // 90% warning
    if (percentageUsed >= 90 && !budgetPeriod.alerts?.warning90) {
      warnings.push(`🚨 90% of ${budgetPeriod.period} budget used for ${budgetPeriod.service} (${budgetPeriod.brand})`);
      await this.updateBudgetPeriod(budgetPeriod.id, {
        'alerts.warning90': true
      });
    }

    // Limit exceeded
    if (percentageUsed >= 100 && !budgetPeriod.alerts?.limitExceeded) {
      warnings.push(`🔴 Budget limit exceeded for ${budgetPeriod.service} (${budgetPeriod.brand}) - ${budgetPeriod.period}`);
      await this.updateBudgetPeriod(budgetPeriod.id, {
        'alerts.limitExceeded': true
      });
    }

    return warnings;
  }

  /**
   * Get budget summary for brand
   */
  static async getBudgetSummary(brand: Brand): Promise<{ [service: string]: { [period: string]: BudgetPeriod } }> {
    const summary: { [service: string]: { [period: string]: BudgetPeriod } } = {};
    const services = ['creatify', 'heygen', 'synthesia', 'submagic', 'openai'];
    const periods = ['daily', 'weekly', 'monthly'];

    for (const service of services) {
      summary[service] = {};
      for (const period of periods) {
        summary[service][period] = await this.getBudgetPeriod(brand, service, period as any);
      }
    }

    return summary;
  }
}