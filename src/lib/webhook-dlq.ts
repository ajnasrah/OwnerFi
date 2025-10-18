/**
 * Webhook Dead Letter Queue (DLQ) System
 *
 * Logs failed webhook processing attempts for later analysis and retry.
 * Stores failures in Firestore for persistence and admin review.
 */

import { db } from './firebase-admin';

// DLQ Entry Type
export interface WebhookDLQEntry {
  id?: string;
  service: 'heygen' | 'submagic' | 'stripe' | 'gohighlevel' | string;
  brand?: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  error: string;
  stack?: string;
  timestamp: number;
  retryCount?: number;
  retried?: boolean;
  retriedAt?: number;
  resolved?: boolean;
  resolvedAt?: number;
  notes?: string;
}

const DLQ_COLLECTION = 'webhook_dlq';
const MAX_DLQ_AGE_DAYS = 30; // Auto-delete after 30 days

/**
 * Log a failed webhook to the DLQ
 * @param entry - DLQ entry data
 * @returns Entry ID
 */
export async function logWebhookFailure(entry: Omit<WebhookDLQEntry, 'id'>): Promise<string> {
  try {
    const docRef = await db.collection(DLQ_COLLECTION).add({
      ...entry,
      retryCount: entry.retryCount || 0,
      retried: false,
      resolved: false,
      createdAt: entry.timestamp || Date.now(),
    });

    console.log(`📝 Logged webhook failure to DLQ: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Failed to log to DLQ:', error);
    // Don't throw - DLQ failures shouldn't block main flow
    return '';
  }
}

/**
 * Get DLQ entries with optional filters
 * @param filters - Filter options
 * @returns Array of DLQ entries
 */
export async function getDLQEntries(filters?: {
  brand?: string;
  service?: string;
  resolved?: boolean;
  limit?: number;
  startAfter?: number;
}): Promise<WebhookDLQEntry[]> {
  try {
    let query: any = db.collection(DLQ_COLLECTION);

    // Apply filters
    if (filters?.brand) {
      query = query.where('brand', '==', filters.brand);
    }

    if (filters?.service) {
      query = query.where('service', '==', filters.service);
    }

    if (filters?.resolved !== undefined) {
      query = query.where('resolved', '==', filters.resolved);
    }

    if (filters?.startAfter) {
      query = query.where('timestamp', '>', filters.startAfter);
    }

    // Order by timestamp desc and limit
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
    console.error('Failed to get DLQ entries:', error);
    return [];
  }
}

/**
 * Get a single DLQ entry by ID
 * @param entryId - DLQ entry ID
 * @returns DLQ entry or null
 */
export async function getDLQEntry(entryId: string): Promise<WebhookDLQEntry | null> {
  try {
    const doc = await db.collection(DLQ_COLLECTION).doc(entryId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as WebhookDLQEntry;
  } catch (error) {
    console.error('Failed to get DLQ entry:', error);
    return null;
  }
}

/**
 * Mark a DLQ entry as retried
 * @param entryId - DLQ entry ID
 * @returns Success boolean
 */
export async function markDLQRetried(entryId: string): Promise<boolean> {
  try {
    await db.collection(DLQ_COLLECTION).doc(entryId).update({
      retried: true,
      retriedAt: Date.now(),
      retryCount: (await db.collection(DLQ_COLLECTION).doc(entryId).get()).data()?.retryCount || 0 + 1,
    });

    console.log(`✅ Marked DLQ entry ${entryId} as retried`);
    return true;
  } catch (error) {
    console.error('Failed to mark DLQ entry as retried:', error);
    return false;
  }
}

/**
 * Mark a DLQ entry as resolved
 * @param entryId - DLQ entry ID
 * @param notes - Optional notes about the resolution
 * @returns Success boolean
 */
export async function markDLQResolved(entryId: string, notes?: string): Promise<boolean> {
  try {
    await db.collection(DLQ_COLLECTION).doc(entryId).update({
      resolved: true,
      resolvedAt: Date.now(),
      notes: notes || undefined,
    });

    console.log(`✅ Marked DLQ entry ${entryId} as resolved`);
    return true;
  } catch (error) {
    console.error('Failed to mark DLQ entry as resolved:', error);
    return false;
  }
}

/**
 * Delete a DLQ entry
 * @param entryId - DLQ entry ID
 * @returns Success boolean
 */
export async function deleteDLQEntry(entryId: string): Promise<boolean> {
  try {
    await db.collection(DLQ_COLLECTION).doc(entryId).delete();
    console.log(`🗑️  Deleted DLQ entry ${entryId}`);
    return true;
  } catch (error) {
    console.error('Failed to delete DLQ entry:', error);
    return false;
  }
}

/**
 * Clean up old DLQ entries (older than MAX_DLQ_AGE_DAYS)
 * @returns Number of entries deleted
 */
export async function cleanupOldDLQEntries(): Promise<number> {
  try {
    const cutoffTime = Date.now() - (MAX_DLQ_AGE_DAYS * 24 * 60 * 60 * 1000);

    const snapshot = await db
      .collection(DLQ_COLLECTION)
      .where('timestamp', '<', cutoffTime)
      .get();

    if (snapshot.empty) {
      console.log('No old DLQ entries to clean up');
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`🗑️  Cleaned up ${snapshot.size} old DLQ entries`);
    return snapshot.size;
  } catch (error) {
    console.error('Failed to clean up old DLQ entries:', error);
    return 0;
  }
}

/**
 * Get DLQ statistics
 * @param brand - Optional brand filter
 * @returns DLQ statistics
 */
export async function getDLQStats(brand?: string): Promise<{
  total: number;
  unresolved: number;
  resolved: number;
  retried: number;
  byService: Record<string, number>;
  byBrand: Record<string, number>;
}> {
  try {
    let query: any = db.collection(DLQ_COLLECTION);

    if (brand) {
      query = query.where('brand', '==', brand);
    }

    const snapshot = await query.get();
    const entries = snapshot.docs.map((doc: any) => doc.data());

    const stats = {
      total: entries.length,
      unresolved: entries.filter((e: any) => !e.resolved).length,
      resolved: entries.filter((e: any) => e.resolved).length,
      retried: entries.filter((e: any) => e.retried).length,
      byService: {} as Record<string, number>,
      byBrand: {} as Record<string, number>,
    };

    // Count by service
    entries.forEach((entry: any) => {
      const service = entry.service || 'unknown';
      stats.byService[service] = (stats.byService[service] || 0) + 1;

      if (entry.brand) {
        stats.byBrand[entry.brand] = (stats.byBrand[entry.brand] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('Failed to get DLQ stats:', error);
    return {
      total: 0,
      unresolved: 0,
      resolved: 0,
      retried: 0,
      byService: {},
      byBrand: {},
    };
  }
}

/**
 * Get recent DLQ failures (last 24 hours)
 * @param brand - Optional brand filter
 * @returns Recent DLQ entries
 */
export async function getRecentDLQFailures(brand?: string): Promise<WebhookDLQEntry[]> {
  const last24Hours = Date.now() - (24 * 60 * 60 * 1000);

  return getDLQEntries({
    brand,
    startAfter: last24Hours,
    resolved: false,
    limit: 100,
  });
}

/**
 * Batch mark multiple DLQ entries as resolved
 * @param entryIds - Array of DLQ entry IDs
 * @param notes - Optional notes
 * @returns Number of entries marked as resolved
 */
export async function batchResolveDLQEntries(
  entryIds: string[],
  notes?: string
): Promise<number> {
  try {
    const batch = db.batch();
    const resolvedAt = Date.now();

    entryIds.forEach((id) => {
      const ref = db.collection(DLQ_COLLECTION).doc(id);
      batch.update(ref, {
        resolved: true,
        resolvedAt,
        notes: notes || undefined,
      });
    });

    await batch.commit();

    console.log(`✅ Batch resolved ${entryIds.length} DLQ entries`);
    return entryIds.length;
  } catch (error) {
    console.error('Failed to batch resolve DLQ entries:', error);
    return 0;
  }
}
