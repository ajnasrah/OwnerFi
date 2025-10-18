/**
 * Brand-Aware Error Logging System
 *
 * Centralized error logging with brand context for better debugging and monitoring.
 */

import { Brand } from '@/config/constants';
import { formatBrandName } from './brand-utils';
import { db } from './firebase-admin';

const ERROR_LOG_COLLECTION = 'error_logs';
const MAX_ERROR_AGE_DAYS = 30;

export interface ErrorLogEntry {
  id?: string;
  brand: Brand;
  brandDisplayName: string;
  service: 'heygen' | 'submagic' | 'late' | 'firebase' | 'general';
  errorType: 'api' | 'webhook' | 'workflow' | 'storage' | 'database' | 'validation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  workflowId?: string;
  userId?: string;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

/**
 * Log an error with brand context
 *
 * @param options - Error logging options
 * @returns Entry ID
 */
export async function logBrandError(options: {
  brand: Brand;
  service: ErrorLogEntry['service'];
  errorType: ErrorLogEntry['errorType'];
  severity: ErrorLogEntry['severity'];
  message: string;
  error?: Error;
  context?: Record<string, any>;
  workflowId?: string;
  userId?: string;
}): Promise<string> {
  try {
    const entry: Omit<ErrorLogEntry, 'id'> = {
      brand: options.brand,
      brandDisplayName: formatBrandName(options.brand),
      service: options.service,
      errorType: options.errorType,
      severity: options.severity,
      message: options.message,
      stack: options.error?.stack,
      context: {
        ...options.context,
        errorName: options.error?.name,
        errorMessage: options.error?.message,
      },
      workflowId: options.workflowId,
      userId: options.userId,
      timestamp: Date.now(),
      resolved: false,
    };

    // Log to console with brand context
    const prefix = `[${entry.brandDisplayName}] [${options.service.toUpperCase()}]`;
    const logMessage = `${prefix} ${entry.message}`;

    switch (options.severity) {
      case 'critical':
      case 'high':
        console.error(`🚨 ${logMessage}`, options.error || '');
        break;
      case 'medium':
        console.warn(`⚠️  ${logMessage}`);
        break;
      case 'low':
        console.log(`ℹ️  ${logMessage}`);
        break;
    }

    // Store in Firestore for persistence
    const docRef = await db.collection(ERROR_LOG_COLLECTION).add(entry);

    return docRef.id;
  } catch (error) {
    // If logging fails, at least log to console
    console.error('Failed to log brand error:', error);
    return '';
  }
}

/**
 * Get error logs with filters
 *
 * @param filters - Filter options
 * @returns Array of error log entries
 */
export async function getErrorLogs(filters?: {
  brand?: Brand;
  service?: string;
  errorType?: string;
  severity?: string;
  resolved?: boolean;
  startDate?: number;
  endDate?: number;
  limit?: number;
}): Promise<ErrorLogEntry[]> {
  try {
    let query: any = db.collection(ERROR_LOG_COLLECTION);

    // Apply filters
    if (filters?.brand) {
      query = query.where('brand', '==', filters.brand);
    }

    if (filters?.service) {
      query = query.where('service', '==', filters.service);
    }

    if (filters?.errorType) {
      query = query.where('errorType', '==', filters.errorType);
    }

    if (filters?.severity) {
      query = query.where('severity', '==', filters.severity);
    }

    if (filters?.resolved !== undefined) {
      query = query.where('resolved', '==', filters.resolved);
    }

    if (filters?.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    // Order by timestamp desc
    query = query.orderBy('timestamp', 'desc');

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Failed to get error logs:', error);
    return [];
  }
}

/**
 * Get error statistics
 *
 * @param brand - Optional brand filter
 * @returns Error statistics
 */
export async function getErrorStats(brand?: Brand): Promise<{
  total: number;
  byBrand: Record<string, number>;
  byService: Record<string, number>;
  byErrorType: Record<string, number>;
  bySeverity: Record<string, number>;
  unresolved: number;
  last24Hours: number;
  last7Days: number;
}> {
  try {
    let query: any = db.collection(ERROR_LOG_COLLECTION);

    if (brand) {
      query = query.where('brand', '==', brand);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map((doc: any) => doc.data() as ErrorLogEntry);

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const stats = {
      total: logs.length,
      byBrand: {} as Record<string, number>,
      byService: {} as Record<string, number>,
      byErrorType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      unresolved: logs.filter(l => !l.resolved).length,
      last24Hours: logs.filter(l => l.timestamp > now - day).length,
      last7Days: logs.filter(l => l.timestamp > now - 7 * day).length,
    };

    logs.forEach(log => {
      stats.byBrand[log.brand] = (stats.byBrand[log.brand] || 0) + 1;
      stats.byService[log.service] = (stats.byService[log.service] || 0) + 1;
      stats.byErrorType[log.errorType] = (stats.byErrorType[log.errorType] || 0) + 1;
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Failed to get error stats:', error);
    return {
      total: 0,
      byBrand: {},
      byService: {},
      byErrorType: {},
      bySeverity: {},
      unresolved: 0,
      last24Hours: 0,
      last7Days: 0,
    };
  }
}

/**
 * Mark error as resolved
 *
 * @param errorId - Error log ID
 * @returns Success boolean
 */
export async function markErrorResolved(errorId: string): Promise<boolean> {
  try {
    await db.collection(ERROR_LOG_COLLECTION).doc(errorId).update({
      resolved: true,
      resolvedAt: Date.now(),
    });

    console.log(`✅ Marked error ${errorId} as resolved`);
    return true;
  } catch (error) {
    console.error('Failed to mark error as resolved:', error);
    return false;
  }
}

/**
 * Clean up old error logs
 *
 * @returns Number of deleted logs
 */
export async function cleanupOldErrorLogs(): Promise<number> {
  try {
    const cutoffTime = Date.now() - (MAX_ERROR_AGE_DAYS * 24 * 60 * 60 * 1000);

    const snapshot = await db
      .collection(ERROR_LOG_COLLECTION)
      .where('timestamp', '<', cutoffTime)
      .where('resolved', '==', true)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`🗑️  Cleaned up ${snapshot.size} old error logs`);
    return snapshot.size;
  } catch (error) {
    console.error('Failed to cleanup error logs:', error);
    return 0;
  }
}

/**
 * Quick logging helpers for common scenarios
 */
export const BrandLogger = {
  /**
   * Log API error
   */
  apiError: (brand: Brand, service: ErrorLogEntry['service'], message: string, error?: Error, context?: Record<string, any>) => {
    return logBrandError({
      brand,
      service,
      errorType: 'api',
      severity: 'high',
      message,
      error,
      context,
    });
  },

  /**
   * Log webhook error
   */
  webhookError: (brand: Brand, service: ErrorLogEntry['service'], message: string, error?: Error, context?: Record<string, any>) => {
    return logBrandError({
      brand,
      service,
      errorType: 'webhook',
      severity: 'high',
      message,
      error,
      context,
    });
  },

  /**
   * Log workflow error
   */
  workflowError: (brand: Brand, workflowId: string, message: string, error?: Error, context?: Record<string, any>) => {
    return logBrandError({
      brand,
      service: 'general',
      errorType: 'workflow',
      severity: 'medium',
      message,
      error,
      context,
      workflowId,
    });
  },

  /**
   * Log critical error
   */
  critical: (brand: Brand, service: ErrorLogEntry['service'], message: string, error?: Error, context?: Record<string, any>) => {
    return logBrandError({
      brand,
      service,
      errorType: 'general',
      severity: 'critical',
      message,
      error,
      context,
    });
  },
};
