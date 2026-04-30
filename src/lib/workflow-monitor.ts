/**
 * Workflow Monitoring and Health Check System
 * 
 * Monitors workflow health, detects stuck processes, and triggers automated recovery
 */

import { db } from './firebase-admin';
import { Brand } from '@/config/constants';
import { WorkflowStateMachine, WorkflowStatus } from './workflow-state-machine';
import { retryWorkflow } from './feed-store-firestore';

interface StuckWorkflow {
  workflowId: string;
  brand: Brand;
  status: WorkflowStatus;
  articleTitle: string;
  createdAt: number;
  lastUpdated: number;
  stuckDuration: number; // minutes
  expectedDuration: number; // minutes
}

interface MonitoringResults {
  stuckWorkflows: StuckWorkflow[];
  actionsPerformed: {
    retry: number;
    alert: number;
    terminate: number;
  };
  summary: {
    totalChecked: number;
    healthyWorkflows: number;
    processingWorkflows: number;
  };
}

export class WorkflowMonitor {
  private static readonly STUCK_THRESHOLD_MULTIPLIER = 3; // 3x expected duration = stuck
  private static readonly MAX_RETRIES = 3;

  /**
   * Check all workflows for stuck processes
   */
  static async checkStuckWorkflows(): Promise<MonitoringResults> {
    const results: MonitoringResults = {
      stuckWorkflows: [],
      actionsPerformed: {
        retry: 0,
        alert: 0,
        terminate: 0
      },
      summary: {
        totalChecked: 0,
        healthyWorkflows: 0,
        processingWorkflows: 0
      }
    };

    const brands: Brand[] = ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza', 'realtors'];

    for (const brand of brands) {
      try {
        await this.checkBrandWorkflows(brand, results);
      } catch (error) {
        console.error(`[Workflow Monitor] Error checking ${brand} workflows:`, error);
      }
    }

    return results;
  }

  /**
   * Check workflows for a specific brand
   */
  private static async checkBrandWorkflows(brand: Brand, results: MonitoringResults): Promise<void> {
    const collectionName = `${brand}_workflow_queue`;
    
    try {
      // Get all non-terminal workflows
      const snapshot = await db.collection(collectionName)
        .where('status', 'in', [
          'pending',
          'heygen_processing', 
          'synthesia_processing',
          'submagic_processing',
          'posting'
        ])
        .get();

      results.summary.totalChecked += snapshot.size;

      for (const doc of snapshot.docs) {
        const workflow = { id: doc.id, ...doc.data() } as any;
        
        const status = workflow.status as WorkflowStatus;
        const lastUpdated = workflow.statusChangedAt || workflow.updatedAt || workflow.createdAt;
        const now = Date.now();

        // Check if workflow is stuck
        if (WorkflowStateMachine.isStuck(status, lastUpdated, this.STUCK_THRESHOLD_MULTIPLIER)) {
          const stuckDuration = Math.round((now - lastUpdated) / (1000 * 60));
          const expectedDuration = WorkflowStateMachine.getExpectedDuration(status);

          const stuckWorkflow: StuckWorkflow = {
            workflowId: workflow.id,
            brand,
            status,
            articleTitle: workflow.articleTitle || 'Unknown',
            createdAt: workflow.createdAt,
            lastUpdated,
            stuckDuration,
            expectedDuration
          };

          results.stuckWorkflows.push(stuckWorkflow);

          // Take automated action
          await this.handleStuckWorkflow(workflow, brand, results);
        } else if (WorkflowStateMachine.isProcessingState(status)) {
          results.summary.processingWorkflows++;
        } else {
          results.summary.healthyWorkflows++;
        }
      }
    } catch (error) {
      console.error(`[Workflow Monitor] Failed to check ${brand} workflows:`, error);
    }
  }

  /**
   * Handle a stuck workflow with automated recovery
   */
  private static async handleStuckWorkflow(
    workflow: any,
    brand: Brand,
    results: MonitoringResults
  ): Promise<void> {
    const retryCount = workflow.retryCount || 0;
    const maxAge = Date.now() - workflow.createdAt;
    const maxAgeHours = maxAge / (1000 * 60 * 60);

    try {
      // Strategy 1: Retry if under limit and not too old
      if (retryCount < this.MAX_RETRIES && maxAgeHours < 24) {
        console.log(`[Workflow Monitor] Retrying stuck workflow ${workflow.id} (attempt ${retryCount + 1})`);
        
        await retryWorkflow(workflow.id, brand);
        results.actionsPerformed.retry++;
        
        return;
      }

      // Strategy 2: Terminate very old workflows
      if (maxAgeHours > 72) { // 3 days old
        console.log(`[Workflow Monitor] Terminating old workflow ${workflow.id} (${maxAgeHours.toFixed(1)}h old)`);
        
        await db.collection(`${brand}_workflow_queue`).doc(workflow.id).update({
          status: 'failed',
          error: 'Terminated by monitoring system due to age',
          terminatedAt: Date.now(),
          statusChangedAt: Date.now()
        });
        
        results.actionsPerformed.terminate++;
        return;
      }

      // Strategy 3: Just alert for manual intervention
      console.warn(`[Workflow Monitor] Workflow ${workflow.id} stuck but max retries reached`);
      results.actionsPerformed.alert++;

    } catch (error) {
      console.error(`[Workflow Monitor] Failed to handle stuck workflow ${workflow.id}:`, error);
    }
  }

  /**
   * Get overall workflow statistics
   */
  static async getWorkflowStats(): Promise<{
    byBrand: { [brand: string]: any };
    totals: any;
    health: 'healthy' | 'warning' | 'critical';
  }> {
    const brands: Brand[] = ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza', 'realtors'];
    const stats: any = {
      byBrand: {},
      totals: {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stuck: 0
      },
      health: 'healthy' as const
    };

    let totalStuck = 0;
    let totalProcessing = 0;

    for (const brand of brands) {
      try {
        const brandStats = await this.getBrandStats(brand);
        stats.byBrand[brand] = brandStats;
        
        // Aggregate totals
        Object.keys(brandStats).forEach(key => {
          if (typeof brandStats[key] === 'number') {
            stats.totals[key] = (stats.totals[key] || 0) + brandStats[key];
          }
        });

        totalStuck += brandStats.stuck || 0;
        totalProcessing += brandStats.processing || 0;
        
      } catch (error) {
        console.error(`[Workflow Monitor] Failed to get stats for ${brand}:`, error);
        stats.byBrand[brand] = { error: error.toString() };
      }
    }

    // Determine overall health
    if (totalStuck > 5 || totalProcessing > 20) {
      stats.health = 'critical';
    } else if (totalStuck > 2 || totalProcessing > 10) {
      stats.health = 'warning';
    }

    return stats;
  }

  /**
   * Get statistics for a specific brand
   */
  private static async getBrandStats(brand: Brand): Promise<any> {
    const collectionName = `${brand}_workflow_queue`;
    
    try {
      const snapshot = await db.collection(collectionName).get();
      const workflows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const stats = {
        total: workflows.length,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stuck: 0,
        avgProcessingTime: 0
      };

      const processingTimes: number[] = [];

      workflows.forEach((workflow: any) => {
        const status = workflow.status;
        const lastUpdated = workflow.statusChangedAt || workflow.updatedAt || workflow.createdAt;

        switch (status) {
          case 'pending':
            stats.pending++;
            break;
          case 'completed':
            stats.completed++;
            if (workflow.completedAt && workflow.createdAt) {
              processingTimes.push(workflow.completedAt - workflow.createdAt);
            }
            break;
          case 'failed':
          case 'video_processing_failed':
            stats.failed++;
            break;
          default:
            stats.processing++;
            // Check if stuck
            if (WorkflowStateMachine.isStuck(status, lastUpdated, this.STUCK_THRESHOLD_MULTIPLIER)) {
              stats.stuck++;
            }
        }
      });

      // Calculate average processing time
      if (processingTimes.length > 0) {
        const avgMs = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        stats.avgProcessingTime = Math.round(avgMs / (1000 * 60)); // Convert to minutes
      }

      return stats;

    } catch (error) {
      console.error(`[Workflow Monitor] Failed to get ${brand} stats:`, error);
      return { error: error.toString() };
    }
  }

  /**
   * Health check for monitoring endpoint
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: { [key: string]: boolean };
    message?: string;
  }> {
    const checks = {
      database: false,
      processingCapacity: false,
      stuckWorkflows: false
    };

    try {
      // Test database connectivity
      await db.collection('test').limit(1).get();
      checks.database = true;

      // Check processing capacity
      const stats = await this.getWorkflowStats();
      checks.processingCapacity = stats.totals.processing < 50; // Arbitrary threshold
      checks.stuckWorkflows = stats.totals.stuck < 5; // Max 5 stuck workflows

      const failedChecks = Object.values(checks).filter(passed => !passed).length;

      if (failedChecks === 0) {
        return { status: 'healthy', checks };
      } else if (failedChecks === 1) {
        return { status: 'degraded', checks, message: 'Some systems experiencing issues' };
      } else {
        return { status: 'unhealthy', checks, message: 'Multiple systems failing' };
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        checks,
        message: `Health check failed: ${error}`
      };
    }
  }
}