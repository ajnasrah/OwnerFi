/**
 * Monitoring and Alerting System
 * Centralized logging and alerting for workflow failures and system health
 */

export interface WorkflowFailureAlert {
  brand: string;
  workflowId: string;
  articleTitle: string;
  status: string;
  error: string;
  retryCount?: number;
  timestamp: number;
}

export interface SystemHealthMetrics {
  totalWorkflows: number;
  completedCount: number;
  failedCount: number;
  stuckCount: number;
  retryingCount: number;
  timestamp: string;
}

/**
 * Log workflow failure with severity level
 */
export async function logWorkflowFailure(alert: WorkflowFailureAlert, severity: 'warning' | 'error' | 'critical' = 'error'): Promise<void> {
  const logEntry = {
    type: 'workflow_failure',
    severity,
    ...alert,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };

  // Console logging with structured format
  console.error(`[${severity.toUpperCase()}] Workflow Failure:`, JSON.stringify(logEntry, null, 2));

  // Store in Firestore for historical tracking
  try {
    const { db } = await import('./firebase');
    const { collection, addDoc } = await import('firebase/firestore');

    if (db) {
      await addDoc(collection(db, 'monitoring_logs'), logEntry);
    }
  } catch (error) {
    console.error('Failed to log to Firestore:', error);
  }

  // Send to external monitoring service (optional integration)
  await sendToMonitoringService(logEntry);
}

/**
 * Log system health metrics
 */
export async function logHealthMetrics(metrics: SystemHealthMetrics): Promise<void> {
  const logEntry = {
    type: 'system_health',
    ...metrics,
    environment: process.env.NODE_ENV || 'development'
  };

  console.log(`[HEALTH] System Metrics:`, JSON.stringify(logEntry, null, 2));

  // Check for concerning metrics
  const failureRate = metrics.totalWorkflows > 0 ? (metrics.failedCount / metrics.totalWorkflows) * 100 : 0;
  const stuckRate = metrics.totalWorkflows > 0 ? (metrics.stuckCount / metrics.totalWorkflows) * 100 : 0;

  if (failureRate > 20) {
    await sendAlert({
      type: 'high_failure_rate',
      message: `Failure rate is ${failureRate.toFixed(1)}% (${metrics.failedCount}/${metrics.totalWorkflows})`,
      severity: 'warning',
      timestamp: Date.now()
    });
  }

  if (stuckRate > 30) {
    await sendAlert({
      type: 'high_stuck_rate',
      message: `Stuck workflow rate is ${stuckRate.toFixed(1)}% (${metrics.stuckCount}/${metrics.totalWorkflows})`,
      severity: 'warning',
      timestamp: Date.now()
    });
  }
}

/**
 * Send alert to configured channels (email, Slack, etc.)
 */
export async function sendAlert(alert: { type: string; message: string; severity: string; timestamp: number }): Promise<void> {
  console.warn(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);

  // TODO: Integrate with your preferred alerting service
  // Examples:
  // - Send to Slack webhook
  // - Send email via SendGrid/Resend
  // - Push to Discord webhook
  // - Send to PagerDuty/Opsgenie

  // Slack example (commented out):
  /*
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  if (SLACK_WEBHOOK_URL) {
    try {
      await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *${alert.severity.toUpperCase()}*: ${alert.message}`,
          attachments: [{
            color: alert.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Type', value: alert.type, short: true },
              { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
            ]
          }]
        })
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }
  */
}

/**
 * Send metrics to external monitoring service
 */
async function sendToMonitoringService(logEntry: any): Promise<void> {
  // TODO: Integrate with monitoring service
  // Examples:
  // - Sentry for error tracking
  // - Datadog for metrics and APM
  // - New Relic for application monitoring
  // - Prometheus + Grafana for custom dashboards

  // Sentry example (commented out):
  /*
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');

    if (logEntry.severity === 'error' || logEntry.severity === 'critical') {
      Sentry.captureException(new Error(logEntry.error || logEntry.message), {
        tags: {
          brand: logEntry.brand,
          workflowId: logEntry.workflowId,
          type: logEntry.type
        },
        level: logEntry.severity as any,
        extra: logEntry
      });
    }
  }
  */
}

/**
 * Track failsafe cron execution metrics
 */
export async function trackFailsafeExecution(
  cronName: string,
  metrics: {
    found: number;
    processed: number;
    completed: number;
    failed: number;
    skipped?: number;
    duration: number;
  }
): Promise<void> {
  const logEntry = {
    type: 'failsafe_execution',
    cronName,
    ...metrics,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  };

  console.log(`[FAILSAFE] ${cronName}:`, JSON.stringify(logEntry, null, 2));

  // Alert if failsafe is processing many workflows (sign of upstream issues)
  if (metrics.found > 5) {
    await sendAlert({
      type: 'failsafe_high_activity',
      message: `${cronName} found ${metrics.found} stuck workflows (${metrics.completed} completed, ${metrics.failed} failed)`,
      severity: 'warning',
      timestamp: Date.now()
    });
  }
}

/**
 * Check system health across all brands
 */
export async function checkSystemHealth(): Promise<SystemHealthMetrics> {
  const { db } = await import('./firebase');
  const { collection, getDocs, query, where } = await import('firebase/firestore');

  if (!db) {
    throw new Error('Firebase not initialized');
  }

  const brands = ['carz', 'ownerfi', 'vassdistro'];
  let totalWorkflows = 0;
  let completedCount = 0;
  let failedCount = 0;
  let stuckCount = 0;
  let retryingCount = 0;

  for (const brand of brands) {
    try {
      const workflowCollection = `${brand}_workflow_queue`;

      // Count all workflows
      const allSnapshot = await getDocs(collection(db, workflowCollection));
      totalWorkflows += allSnapshot.size;

      // Count by status
      const completedSnapshot = await getDocs(query(collection(db, workflowCollection), where('status', '==', 'completed')));
      completedCount += completedSnapshot.size;

      const failedSnapshot = await getDocs(query(collection(db, workflowCollection), where('status', '==', 'failed')));
      failedCount += failedSnapshot.size;

      // Count stuck (in processing for > 30 min)
      const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
      const processingStates = ['heygen_processing', 'submagic_processing', 'video_processing', 'posting'];

      for (const status of processingStates) {
        const stuckSnapshot = await getDocs(
          query(
            collection(db, workflowCollection),
            where('status', '==', status),
            where('statusChangedAt', '<', thirtyMinsAgo)
          )
        );
        stuckCount += stuckSnapshot.size;
      }

      // Count retrying (retryCount > 0)
      const retryingSnapshot = await getDocs(
        query(
          collection(db, workflowCollection),
          where('retryCount', '>', 0)
        )
      );
      retryingCount += retryingSnapshot.size;

    } catch (error) {
      console.error(`Error checking health for ${brand}:`, error);
    }
  }

  const metrics: SystemHealthMetrics = {
    totalWorkflows,
    completedCount,
    failedCount,
    stuckCount,
    retryingCount,
    timestamp: new Date().toISOString()
  };

  await logHealthMetrics(metrics);

  return metrics;
}
