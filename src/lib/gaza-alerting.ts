/**
 * Gaza System Error Alerting
 *
 * Provides alerting and notification capabilities for Gaza workflow failures.
 * Logs to Firestore for monitoring and can be extended to send email/Slack alerts.
 */

export type GazaAlertSeverity = 'critical' | 'error' | 'warning' | 'info';

export type GazaAlertType =
  | 'env_validation_failed'
  | 'feed_health_check_failed'
  | 'article_selection_failed'
  | 'script_generation_failed'
  | 'heygen_generation_failed'
  | 'submagic_processing_failed'
  | 'hook_processing_failed'
  | 'late_posting_failed'
  | 'workflow_stuck'
  | 'daily_limit_reached';

export interface GazaAlert {
  id: string;
  type: GazaAlertType;
  severity: GazaAlertSeverity;
  message: string;
  details?: Record<string, any>;
  workflowId?: string;
  articleId?: string;
  resolved: boolean;
  createdAt: number;
  resolvedAt?: number;
}

/**
 * Log an alert to Firestore
 */
export async function logGazaAlert(
  type: GazaAlertType,
  severity: GazaAlertSeverity,
  message: string,
  details?: Record<string, any>
): Promise<string> {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const alertId = `gaza_alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const alert: GazaAlert = {
      id: alertId,
      type,
      severity,
      message,
      details,
      workflowId: details?.workflowId,
      articleId: details?.articleId,
      resolved: false,
      createdAt: Date.now(),
    };

    await adminDb.collection('gaza_alerts').doc(alertId).set(alert);

    // Log to console with appropriate emoji
    const emoji = {
      critical: '🚨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    }[severity];

    console.log(`${emoji} [GAZA ALERT] ${severity.toUpperCase()}: ${message}`);
    if (details) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }

    // For critical alerts, also log a stack trace
    if (severity === 'critical') {
      console.log(`   Stack trace:`, new Error().stack);
    }

    return alertId;
  } catch (error) {
    // Don't fail if alerting fails - just log to console
    console.error('Failed to log Gaza alert:', error);
    console.error(`Original alert: ${severity} - ${message}`, details);
    return '';
  }
}

/**
 * Alert for environment validation failures
 */
export async function alertEnvValidationFailed(errors: string[]): Promise<void> {
  await logGazaAlert(
    'env_validation_failed',
    'critical',
    'Gaza system environment validation failed',
    { errors, count: errors.length }
  );
}

/**
 * Alert for feed health check failures
 */
export async function alertFeedHealthCheckFailed(
  feedId: string,
  feedName: string,
  error: string
): Promise<void> {
  await logGazaAlert(
    'feed_health_check_failed',
    'warning',
    `Feed health check failed: ${feedName}`,
    { feedId, feedName, error }
  );
}

/**
 * Alert for article selection failures
 */
export async function alertArticleSelectionFailed(reason: string): Promise<void> {
  await logGazaAlert(
    'article_selection_failed',
    'error',
    'No articles available for Gaza video generation',
    { reason }
  );
}

/**
 * Alert for script generation failures
 */
export async function alertScriptGenerationFailed(
  workflowId: string,
  articleTitle: string,
  error: string,
  usingFallback: boolean
): Promise<void> {
  await logGazaAlert(
    'script_generation_failed',
    usingFallback ? 'warning' : 'error',
    usingFallback
      ? `Script generation failed, using fallback: ${articleTitle}`
      : `Script generation failed completely: ${articleTitle}`,
    { workflowId, articleTitle, error, usingFallback }
  );
}

/**
 * Alert for HeyGen generation failures
 */
export async function alertHeyGenFailed(
  workflowId: string,
  articleTitle: string,
  error: string
): Promise<void> {
  await logGazaAlert(
    'heygen_generation_failed',
    'error',
    `HeyGen video generation failed: ${articleTitle}`,
    { workflowId, articleTitle, error }
  );
}

/**
 * Alert for Submagic processing failures
 */
export async function alertSubmagicFailed(
  workflowId: string,
  articleTitle: string,
  error: string
): Promise<void> {
  await logGazaAlert(
    'submagic_processing_failed',
    'error',
    `Submagic caption processing failed: ${articleTitle}`,
    { workflowId, articleTitle, error }
  );
}

/**
 * Alert for hook processing failures
 */
export async function alertHookProcessingFailed(
  workflowId: string,
  error: string,
  hookId?: string
): Promise<void> {
  await logGazaAlert(
    'hook_processing_failed',
    'warning',
    `Hook processing failed for workflow ${workflowId}`,
    { workflowId, error, hookId, skippedHook: true }
  );
}

/**
 * Alert for Late API posting failures
 */
export async function alertLatePostingFailed(
  workflowId: string,
  articleTitle: string,
  error: string
): Promise<void> {
  await logGazaAlert(
    'late_posting_failed',
    'error',
    `Late API posting failed: ${articleTitle}`,
    { workflowId, articleTitle, error }
  );
}

/**
 * Alert for stuck workflows
 */
export async function alertWorkflowStuck(
  workflowId: string,
  status: string,
  stuckMinutes: number
): Promise<void> {
  await logGazaAlert(
    'workflow_stuck',
    'warning',
    `Gaza workflow stuck in ${status} for ${stuckMinutes} minutes`,
    { workflowId, status, stuckMinutes }
  );
}

/**
 * Alert when daily limit is reached
 */
export async function alertDailyLimitReached(
  videosGenerated: number,
  maxPerDay: number
): Promise<void> {
  await logGazaAlert(
    'daily_limit_reached',
    'info',
    `Gaza daily video limit reached: ${videosGenerated}/${maxPerDay}`,
    { videosGenerated, maxPerDay }
  );
}

/**
 * Get recent unresolved alerts
 */
export async function getUnresolvedAlerts(
  limit: number = 20
): Promise<GazaAlert[]> {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const snapshot = await adminDb
      .collection('gaza_alerts')
      .where('resolved', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data() as GazaAlert);
  } catch (error) {
    console.error('Failed to get unresolved alerts:', error);
    return [];
  }
}

/**
 * Mark an alert as resolved
 */
export async function resolveAlert(alertId: string): Promise<void> {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    await adminDb.collection('gaza_alerts').doc(alertId).update({
      resolved: true,
      resolvedAt: Date.now(),
    });

    console.log(`✅ Alert ${alertId} marked as resolved`);
  } catch (error) {
    console.error('Failed to resolve alert:', error);
  }
}

/**
 * Get alert statistics
 */
export async function getAlertStats(): Promise<{
  total: number;
  unresolved: number;
  bySeverity: Record<GazaAlertSeverity, number>;
  byType: Record<string, number>;
  last24Hours: number;
}> {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Get all alerts from last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snapshot = await adminDb
      .collection('gaza_alerts')
      .where('createdAt', '>=', sevenDaysAgo)
      .get();

    const alerts = snapshot.docs.map(doc => doc.data() as GazaAlert);

    const stats = {
      total: alerts.length,
      unresolved: alerts.filter(a => !a.resolved).length,
      bySeverity: {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0,
      } as Record<GazaAlertSeverity, number>,
      byType: {} as Record<string, number>,
      last24Hours: alerts.filter(a => a.createdAt >= oneDayAgo).length,
    };

    for (const alert of alerts) {
      stats.bySeverity[alert.severity]++;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    }

    return stats;
  } catch (error) {
    console.error('Failed to get alert stats:', error);
    return {
      total: 0,
      unresolved: 0,
      bySeverity: { critical: 0, error: 0, warning: 0, info: 0 },
      byType: {},
      last24Hours: 0,
    };
  }
}
