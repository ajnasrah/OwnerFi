/**
 * Admin API: Webhook Health Monitoring
 *
 * GET /api/admin/webhook-health - Get webhook health metrics
 *
 * Provides comprehensive health metrics for all brand webhooks including:
 * - DLQ statistics
 * - Error logs
 * - Idempotency stats
 * - Recent webhook activity
 * - Success/failure rates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDLQStats, getRecentDLQFailures } from '@/lib/webhook-dlq';
import { getErrorStats, getErrorLogs } from '@/lib/brand-error-logger';
import { getIdempotencyStats } from '@/lib/webhook-idempotency';
import { Brand } from '@/config/constants';

/**
 * GET - Get webhook health metrics
 *
 * Query params:
 * - brand: Filter by brand (carz, ownerfi, benefit, abdullah, personal, gaza)
 * - timeframe: Timeframe for metrics (24h, 7d, 30d)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brand = searchParams.get('brand') as Brand | null;
    const timeframe = searchParams.get('timeframe') || '24h';

    console.log(`📊 Fetching webhook health metrics (brand: ${brand || 'all'}, timeframe: ${timeframe})`);

    // Get metrics from all sources
    const [dlqStats, errorStats, idempotencyStats, recentFailures] = await Promise.all([
      getDLQStats(brand || undefined),
      getErrorStats(brand || undefined),
      getIdempotencyStats(undefined, brand || undefined),
      getRecentDLQFailures(brand || undefined),
    ]);

    // Calculate time ranges
    const now = Date.now();
    const timeRanges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const timeRange = timeRanges[timeframe as keyof typeof timeRanges] || timeRanges['24h'];
    const startTime = now - timeRange;

    // Get recent error logs for the timeframe
    const recentErrors = await getErrorLogs({
      brand: brand || undefined,
      startDate: startTime,
      limit: 100,
    });

    // Calculate webhook health score (0-100)
    const healthScore = calculateHealthScore({
      dlqStats,
      errorStats,
      recentFailures,
      recentErrors,
    });

    // Build per-brand metrics
    const brands: Brand[] = brand ? [brand] : ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza'];
    const brandMetrics = await Promise.all(
      brands.map(async (b) => {
        const brandDLQ = await getDLQStats(b);
        const brandErrors = await getErrorStats(b);
        const brandIdempotency = await getIdempotencyStats(undefined, b);

        return {
          brand: b,
          dlq: brandDLQ,
          errors: brandErrors,
          idempotency: brandIdempotency,
          healthScore: calculateHealthScore({
            dlqStats: brandDLQ,
            errorStats: brandErrors,
            recentFailures: recentFailures.filter(f => f.brand === b),
            recentErrors: recentErrors.filter(e => e.brand === b),
          }),
        };
      })
    );

    // Build response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      timeframe,
      healthScore,
      overall: {
        dlq: dlqStats,
        errors: errorStats,
        idempotency: idempotencyStats,
        recentFailures: recentFailures.length,
        recentErrors: recentErrors.length,
      },
      brands: brandMetrics,
      recentFailures: recentFailures.slice(0, 10), // Last 10 failures
      recentErrors: recentErrors.slice(0, 10), // Last 10 errors
      alerts: generateAlerts(brandMetrics),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching webhook health:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate webhook health score (0-100)
 *
 * Factors:
 * - DLQ size (lower is better)
 * - Error count (lower is better)
 * - Unresolved issues (lower is better)
 * - Recent failures (lower is better)
 */
function calculateHealthScore(metrics: {
  dlqStats: any;
  errorStats: any;
  recentFailures: any[];
  recentErrors: any[];
}): number {
  let score = 100;

  // Penalize for unresolved DLQ entries
  score -= Math.min(metrics.dlqStats.unresolved * 2, 30);

  // Penalize for unresolved errors
  score -= Math.min(metrics.errorStats.unresolved * 1, 20);

  // Penalize for recent failures
  score -= Math.min(metrics.recentFailures.length * 3, 25);

  // Penalize for critical errors
  const criticalErrors = metrics.recentErrors.filter((e: any) => e.severity === 'critical').length;
  score -= Math.min(criticalErrors * 5, 25);

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate alerts based on brand metrics
 */
function generateAlerts(brandMetrics: any[]): any[] {
  const alerts = [];

  for (const metric of brandMetrics) {
    // Alert on low health score
    if (metric.healthScore < 70) {
      alerts.push({
        severity: metric.healthScore < 50 ? 'critical' : 'warning',
        brand: metric.brand,
        message: `${metric.brand} webhook health is ${metric.healthScore}/100`,
        type: 'health_score',
      });
    }

    // Alert on high DLQ count
    if (metric.dlq.unresolved > 10) {
      alerts.push({
        severity: 'warning',
        brand: metric.brand,
        message: `${metric.brand} has ${metric.dlq.unresolved} unresolved webhook failures`,
        type: 'dlq',
      });
    }

    // Alert on high error count
    if (metric.errors.last24Hours > 20) {
      alerts.push({
        severity: 'warning',
        brand: metric.brand,
        message: `${metric.brand} has ${metric.errors.last24Hours} errors in last 24 hours`,
        type: 'errors',
      });
    }

    // Alert on critical errors
    const criticalCount = metric.errors.bySeverity.critical || 0;
    if (criticalCount > 0) {
      alerts.push({
        severity: 'critical',
        brand: metric.brand,
        message: `${metric.brand} has ${criticalCount} critical errors`,
        type: 'critical_errors',
      });
    }
  }

  return alerts;
}
