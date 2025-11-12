/**
 * Audit Logging System
 *
 * Logs all administrative actions and sensitive operations for security and compliance.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin-init';

export enum AuditAction {
  // User Management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',

  // Property Management
  PROPERTY_CREATED = 'PROPERTY_CREATED',
  PROPERTY_UPDATED = 'PROPERTY_UPDATED',
  PROPERTY_DELETED = 'PROPERTY_DELETED',
  PROPERTY_BULK_DELETE = 'PROPERTY_BULK_DELETE',

  // Admin Actions
  CREDITS_ADDED = 'CREDITS_ADDED',
  CREDITS_DEDUCTED = 'CREDITS_DEDUCTED',
  DATABASE_CLEANED = 'DATABASE_CLEANED',
  WORKFLOW_RETRIED = 'WORKFLOW_RETRIED',
  SUBSCRIPTION_MODIFIED = 'SUBSCRIPTION_MODIFIED',

  // Security
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  WEBHOOK_VERIFICATION_FAILED = 'WEBHOOK_VERIFICATION_FAILED',

  // System
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  API_KEY_ROTATED = 'API_KEY_ROTATED',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  severity: AuditSeverity;
  actor: {
    userId?: string;
    email?: string;
    role?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id?: string;
    name?: string;
  };
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log an audit event to Firestore
 */
export async function logAuditEvent(
  action: AuditAction,
  actor: AuditLogEntry['actor'],
  resource: AuditLogEntry['resource'],
  options: {
    severity?: AuditSeverity;
    changes?: AuditLogEntry['changes'];
    metadata?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const {
    severity = AuditSeverity.INFO,
    changes,
    metadata,
    success = true,
    errorMessage,
  } = options;

  const logEntry: Omit<AuditLogEntry, 'id'> = {
    timestamp: new Date().toISOString(),
    action,
    severity,
    actor,
    resource,
    changes,
    metadata,
    success,
    errorMessage,
  };

  try {
    const db = getAdminDb();
    if (!db) {
      console.error('[Audit] Firebase not initialized, logging to console only');
      console.log('[Audit]', JSON.stringify(logEntry, null, 2));
      return;
    }

    const auditRef = await db.collection('audit_logs').add({
      ...logEntry,
      id: '', // Will be set after creation
    });

    // Update the document with its own ID
    await auditRef.update({ id: auditRef.id });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Audit] ${action}:`, logEntry);
    }
  } catch (error) {
    console.error('[Audit] Failed to log audit event:', error);
    // Fallback to console logging
    console.log('[Audit] (Fallback)', JSON.stringify(logEntry, null, 2));
  }
}

/**
 * Extract actor information from request
 */
export function extractActorFromRequest(
  request: Request,
  session?: { user?: { id?: string; email?: string; role?: string } }
): AuditLogEntry['actor'] {
  return {
    userId: session?.user?.id,
    email: session?.user?.email,
    role: session?.user?.role,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * Helper functions for common audit scenarios
 */
export const AuditHelpers = {
  /**
   * Log admin credit addition
   */
  async logCreditsAdded(
    actor: AuditLogEntry['actor'],
    realtorId: string,
    realtorEmail: string,
    amount: number
  ): Promise<void> {
    await logAuditEvent(
      AuditAction.CREDITS_ADDED,
      actor,
      { type: 'realtor', id: realtorId, name: realtorEmail },
      {
        severity: AuditSeverity.WARNING,
        metadata: { creditsAdded: amount },
      }
    );
  },

  /**
   * Log database cleanup
   */
  async logDatabaseCleanup(
    actor: AuditLogEntry['actor'],
    action: string,
    itemsAffected: number
  ): Promise<void> {
    await logAuditEvent(
      AuditAction.DATABASE_CLEANED,
      actor,
      { type: 'database', name: action },
      {
        severity: AuditSeverity.CRITICAL,
        metadata: { action, itemsAffected },
      }
    );
  },

  /**
   * Log authentication failure
   */
  async logAuthFailure(
    actor: AuditLogEntry['actor'],
    reason: string
  ): Promise<void> {
    await logAuditEvent(
      AuditAction.AUTHENTICATION_FAILED,
      actor,
      { type: 'authentication' },
      {
        severity: AuditSeverity.WARNING,
        success: false,
        errorMessage: reason,
      }
    );
  },

  /**
   * Log webhook verification failure
   */
  async logWebhookFailure(
    service: string,
    ipAddress: string,
    reason: string
  ): Promise<void> {
    await logAuditEvent(
      AuditAction.WEBHOOK_VERIFICATION_FAILED,
      { ipAddress },
      { type: 'webhook', name: service },
      {
        severity: AuditSeverity.CRITICAL,
        success: false,
        errorMessage: reason,
      }
    );
  },

  /**
   * Log bulk property deletion
   */
  async logBulkPropertyDelete(
    actor: AuditLogEntry['actor'],
    propertyIds: string[]
  ): Promise<void> {
    await logAuditEvent(
      AuditAction.PROPERTY_BULK_DELETE,
      actor,
      { type: 'properties' },
      {
        severity: AuditSeverity.CRITICAL,
        metadata: {
          count: propertyIds.length,
          propertyIds: propertyIds.slice(0, 10), // Log first 10
        },
      }
    );
  },
};

/**
 * Query audit logs
 */
export async function getAuditLogs(
  filters: {
    action?: AuditAction;
    actorId?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<AuditLogEntry[]> {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  let query = db.collection('audit_logs').orderBy('timestamp', 'desc');

  if (filters.action) {
    query = query.where('action', '==', filters.action) as any;
  }

  if (filters.actorId) {
    query = query.where('actor.userId', '==', filters.actorId) as any;
  }

  if (filters.resourceType) {
    query = query.where('resource.type', '==', filters.resourceType) as any;
  }

  if (filters.startDate) {
    query = query.where('timestamp', '>=', filters.startDate.toISOString()) as any;
  }

  if (filters.endDate) {
    query = query.where('timestamp', '<=', filters.endDate.toISOString()) as any;
  }

  if (filters.limit) {
    query = query.limit(filters.limit) as any;
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => doc.data() as AuditLogEntry);
}
