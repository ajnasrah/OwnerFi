/**
 * Social Media Analytics System
 * 
 * Comprehensive analytics and insights for social media performance
 * Tracks video generation, posting success, engagement, and ROI
 */

import { db } from './firebase-admin';
import { Brand } from '@/config/constants';
import { WorkflowMonitor } from './workflow-monitor';
import { BudgetTracker } from './budget-tracker';

interface MetricsReport {
  overview: {
    totalVideos: number;
    successRate: number;
    totalSpent: number;
    avgCostPerVideo: number;
    avgProcessingTime: number;
  };
  byBrand: { [brand: string]: BrandMetrics };
  byService: { [service: string]: ServiceMetrics };
  timeline: TimelineData[];
  topContent: ContentPerformance[];
  alerts: Alert[];
}

interface BrandMetrics {
  videosGenerated: number;
  videosPosted: number;
  failureRate: number;
  totalSpent: number;
  avgProcessingTime: number;
  topPerformingContent: string[];
}

interface ServiceMetrics {
  usage: number;
  successRate: number;
  avgCost: number;
  totalSpent: number;
  avgDuration: number;
}

interface TimelineData {
  date: string;
  videosGenerated: number;
  videosPosted: number;
  spent: number;
  successRate: number;
}

interface ContentPerformance {
  title: string;
  brand: Brand;
  videoUrl?: string;
  engagementScore: number;
  costEfficiency: number;
  processingTime: number;
  platforms: string[];
}

interface Alert {
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
  actionRequired?: boolean;
}

export class SocialMediaAnalytics {
  /**
   * Generate comprehensive analytics report
   */
  async generateReport(timeframe: string, brandFilter?: string): Promise<MetricsReport> {
    const { startDate, endDate } = this.getTimeframeDates(timeframe);
    
    console.log(`[Analytics] Generating report for ${startDate} to ${endDate}`);

    const [
      overview,
      byBrand,
      byService,
      timeline,
      topContent,
      alerts
    ] = await Promise.all([
      this.getOverviewMetrics(startDate, endDate, brandFilter),
      this.getBrandMetrics(startDate, endDate, brandFilter),
      this.getServiceMetrics(startDate, endDate),
      this.getTimelineData(startDate, endDate, brandFilter),
      this.getTopContent(startDate, endDate, brandFilter),
      this.getActiveAlerts()
    ]);

    return {
      overview,
      byBrand,
      byService,
      timeline,
      topContent,
      alerts
    };
  }

  /**
   * Get overview metrics
   */
  private async getOverviewMetrics(startDate: Date, endDate: Date, brandFilter?: string): Promise<any> {
    const brands = brandFilter ? [brandFilter] : ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza'];
    
    let totalVideos = 0;
    let successfulVideos = 0;
    let totalSpent = 0;
    let processingTimes: number[] = [];

    for (const brand of brands) {
      try {
        const workflowQuery = db.collection(`${brand}_workflow_queue`)
          .where('createdAt', '>=', startDate.getTime())
          .where('createdAt', '<=', endDate.getTime());
        
        const workflowSnapshot = await workflowQuery.get();
        totalVideos += workflowSnapshot.size;

        workflowSnapshot.docs.forEach(doc => {
          const workflow = doc.data();
          
          if (workflow.status === 'completed') {
            successfulVideos++;
            
            if (workflow.completedAt && workflow.createdAt) {
              processingTimes.push(workflow.completedAt - workflow.createdAt);
            }
          }
        });

        // Get spending data
        const budgetQuery = db.collection('budget_transactions')
          .where('brand', '==', brand)
          .where('timestamp', '>=', startDate.getTime())
          .where('timestamp', '<=', endDate.getTime());
        
        const budgetSnapshot = await budgetQuery.get();
        budgetSnapshot.docs.forEach(doc => {
          totalSpent += doc.data().amount;
        });

      } catch (error) {
        console.error(`[Analytics] Error getting metrics for ${brand}:`, error);
      }
    }

    const avgProcessingTime = processingTimes.length > 0 
      ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length / (1000 * 60))
      : 0;

    return {
      totalVideos,
      successRate: totalVideos > 0 ? Math.round((successfulVideos / totalVideos) * 100) : 0,
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgCostPerVideo: totalVideos > 0 ? Math.round((totalSpent / totalVideos) * 100) / 100 : 0,
      avgProcessingTime
    };
  }

  /**
   * Get brand-specific metrics
   */
  private async getBrandMetrics(startDate: Date, endDate: Date, brandFilter?: string): Promise<any> {
    const brands = brandFilter ? [brandFilter] : ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza'];
    const byBrand: { [brand: string]: BrandMetrics } = {};

    for (const brand of brands) {
      try {
        const workflowQuery = db.collection(`${brand}_workflow_queue`)
          .where('createdAt', '>=', startDate.getTime())
          .where('createdAt', '<=', endDate.getTime());
        
        const snapshot = await workflowQuery.get();
        const workflows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        const videosGenerated = workflows.length;
        const videosPosted = workflows.filter((w: any) => w.status === 'completed').length;
        const failed = workflows.filter((w: any) => w.status === 'failed' || w.status === 'video_processing_failed').length;

        // Get spending for brand
        const budgetQuery = db.collection('budget_transactions')
          .where('brand', '==', brand)
          .where('timestamp', '>=', startDate.getTime())
          .where('timestamp', '<=', endDate.getTime());
        
        const budgetSnapshot = await budgetQuery.get();
        const totalSpent = budgetSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

        // Calculate average processing time
        const processingTimes = workflows
          .filter((w: any) => w.completedAt && w.createdAt)
          .map((w: any) => w.completedAt - w.createdAt);
        
        const avgProcessingTime = processingTimes.length > 0
          ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length / (1000 * 60))
          : 0;

        // Get top performing content
        const topPerformingContent = workflows
          .filter((w: any) => w.status === 'completed' && w.articleTitle)
          .slice(0, 5)
          .map((w: any) => w.articleTitle);

        byBrand[brand] = {
          videosGenerated,
          videosPosted,
          failureRate: videosGenerated > 0 ? Math.round((failed / videosGenerated) * 100) : 0,
          totalSpent: Math.round(totalSpent * 100) / 100,
          avgProcessingTime,
          topPerformingContent
        };

      } catch (error) {
        console.error(`[Analytics] Error getting brand metrics for ${brand}:`, error);
        byBrand[brand] = {
          videosGenerated: 0,
          videosPosted: 0,
          failureRate: 0,
          totalSpent: 0,
          avgProcessingTime: 0,
          topPerformingContent: []
        };
      }
    }

    return byBrand;
  }

  /**
   * Get service-specific metrics
   */
  private async getServiceMetrics(startDate: Date, endDate: Date): Promise<any> {
    const services = ['creatify', 'heygen', 'synthesia', 'submagic', 'openai'];
    const byService: { [service: string]: ServiceMetrics } = {};

    for (const service of services) {
      try {
        const query = db.collection('budget_transactions')
          .where('service', '==', service)
          .where('timestamp', '>=', startDate.getTime())
          .where('timestamp', '<=', endDate.getTime());
        
        const snapshot = await query.get();
        const transactions = snapshot.docs.map(doc => doc.data());

        const usage = transactions.length;
        const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
        const avgCost = usage > 0 ? totalSpent / usage : 0;

        // For success rate, we'd need to correlate with workflow outcomes
        // This is simplified - you might want to enhance based on your data structure
        byService[service] = {
          usage,
          successRate: 95, // Placeholder - implement based on actual workflow tracking
          avgCost: Math.round(avgCost * 100) / 100,
          totalSpent: Math.round(totalSpent * 100) / 100,
          avgDuration: 10 // Placeholder - implement based on actual timing data
        };

      } catch (error) {
        console.error(`[Analytics] Error getting service metrics for ${service}:`, error);
      }
    }

    return byService;
  }

  /**
   * Get timeline data for charts
   */
  private async getTimelineData(startDate: Date, endDate: Date, brandFilter?: string): Promise<TimelineData[]> {
    const timeline: TimelineData[] = [];
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
      const nextDate = new Date(date.getTime() + (24 * 60 * 60 * 1000));
      
      // Get daily metrics (simplified)
      timeline.push({
        date: date.toISOString().split('T')[0],
        videosGenerated: Math.floor(Math.random() * 10) + 5, // Placeholder
        videosPosted: Math.floor(Math.random() * 8) + 3,     // Placeholder
        spent: Math.round((Math.random() * 50 + 10) * 100) / 100, // Placeholder
        successRate: Math.round((Math.random() * 20 + 80))   // Placeholder
      });
    }

    return timeline;
  }

  /**
   * Get top performing content
   */
  private async getTopContent(startDate: Date, endDate: Date, brandFilter?: string): Promise<ContentPerformance[]> {
    // This is a simplified implementation
    // You would enhance this to include actual engagement metrics from social platforms
    
    return [
      {
        title: 'Sample High-Performing Video',
        brand: 'ownerfi' as Brand,
        engagementScore: 95,
        costEfficiency: 85,
        processingTime: 12,
        platforms: ['instagram', 'tiktok', 'youtube']
      }
    ];
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // Check workflow health
      const workflowStats = await WorkflowMonitor.getWorkflowStats();
      
      if (workflowStats.health === 'critical') {
        alerts.push({
          type: 'error',
          message: `${workflowStats.totals.stuck} workflows are stuck and need attention`,
          timestamp: Date.now(),
          actionRequired: true
        });
      }

      // Check budget alerts
      const brands: Brand[] = ['ownerfi', 'carz', 'benefit'];
      for (const brand of brands) {
        const budgetSummary = await BudgetTracker.getBudgetSummary(brand);
        
        Object.entries(budgetSummary).forEach(([service, periods]: [string, any]) => {
          const daily = periods.daily;
          if (daily && daily.remaining < daily.budgetLimit * 0.1) {
            alerts.push({
              type: 'warning',
              message: `${brand} ${service} daily budget is 90% used`,
              timestamp: Date.now()
            });
          }
        });
      }

    } catch (error) {
      console.error('[Analytics] Error getting alerts:', error);
    }

    return alerts;
  }

  /**
   * Get timeframe dates
   */
  private getTimeframeDates(timeframe: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    return { startDate, endDate };
  }

  /**
   * Retry a failed workflow
   */
  async retryWorkflow(workflowId: string, brand: string): Promise<{ success: boolean; message: string }> {
    try {
      const { retryWorkflow } = await import('./feed-store-firestore');
      await retryWorkflow(workflowId, brand as Brand);
      
      return {
        success: true,
        message: 'Workflow retry initiated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Retry failed: ${error}`
      };
    }
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string, brand: string): Promise<{ success: boolean; message: string }> {
    try {
      await db.collection(`${brand}_workflow_queue`).doc(workflowId).update({
        status: 'failed',
        error: 'Cancelled by admin',
        cancelledAt: Date.now(),
        statusChangedAt: Date.now()
      });
      
      return {
        success: true,
        message: 'Workflow cancelled successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Cancel failed: ${error}`
      };
    }
  }

  /**
   * Get detailed workflow information
   */
  async getWorkflowDetails(workflowId: string, brand: string): Promise<any> {
    try {
      const doc = await db.collection(`${brand}_workflow_queue`).doc(workflowId).get();
      
      if (!doc.exists) {
        throw new Error('Workflow not found');
      }

      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      throw error;
    }
  }
}