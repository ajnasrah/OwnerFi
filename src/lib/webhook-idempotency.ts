/**
 * Webhook Idempotency System
 *
 * Prevents duplicate webhook processing when external services retry requests.
 * Uses Firestore to track processed webhook IDs with TTL.
 */

import crypto from 'crypto';
import { getAdminDb } from './firebase-admin';

const IDEMPOTENCY_COLLECTION = 'webhook_idempotency';
const IDEMPOTENCY_TTL_HOURS = 24; // Keep records for 24 hours

export interface IdempotencyRecord {
  id: string;
  service: 'heygen' | 'submagic' | 'stripe' | 'gohighlevel';
  brand?: string;
  webhookId: string;
  processedAt: number;
  expiresAt: number;
  requestHash: string;
  response?: unknown;
}

/**
 * Generate a unique idempotency key from webhook data
 *
 * @param service - Service name
 * @param webhookId - Unique webhook identifier (e.g., video_id, project_id)
 * @param brand - Optional brand identifier
 * @returns Idempotency key
 */
export function generateIdempotencyKey(
  service: string,
  webhookId: string,
  brand?: string
): string {
  const parts = [service, webhookId];
  if (brand) parts.push(brand);
  return parts.join(':');
}

/**
 * Generate hash of request for additional verification
 *
 * @param body - Request body
 * @returns SHA-256 hash
 */
function hashRequest(body: unknown): string {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  return crypto.createHash('sha256').update(bodyString).digest('hex');
}

/**
 * Check if webhook has already been processed
 *
 * @param service - Service name
 * @param webhookId - Unique webhook identifier
 * @param brand - Optional brand identifier
 * @param requestBody - Request body for hash verification
 * @returns True if already processed, along with previous response
 */
export async function isWebhookProcessed(
  service: 'heygen' | 'submagic' | 'stripe' | 'gohighlevel',
  webhookId: string,
  brand?: string,
  requestBody?: unknown
): Promise<{ processed: boolean; previousResponse?: unknown }> {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.warn('⚠️  Firebase Admin not initialized - skipping idempotency check');
      return { processed: false };
    }
    const key = generateIdempotencyKey(service, webhookId, brand);
    const doc = await db.collection(IDEMPOTENCY_COLLECTION).doc(key).get();

    if (!doc.exists) {
      return { processed: false };
    }

    const record = doc.data() as IdempotencyRecord;

    // Check if record has expired
    if (Date.now() > record.expiresAt) {
      // Clean up expired record
      await db!.collection(IDEMPOTENCY_COLLECTION).doc(key).delete();
      return { processed: false };
    }

    // Optionally verify request hash matches
    if (requestBody) {
      const requestHash = hashRequest(requestBody);
      if (requestHash !== record.requestHash) {
        console.warn(
          `⚠️  Webhook ${key} already processed but request hash differs. Possible replay attack or legitimate retry with different payload.`
        );
      }
    }

    console.log(`✅ Webhook ${key} already processed at ${new Date(record.processedAt).toISOString()}`);

    return {
      processed: true,
      previousResponse: record.response,
    };
  } catch (error) {
    console.error('Error checking webhook idempotency:', error);
    // CRITICAL: Fail CLOSED to prevent duplicates - better to skip than double-process
    // If Firebase is down, we'd rather miss a webhook than create duplicate posts
    console.warn('⚠️  Idempotency check failed - blocking processing to prevent duplicates');
    return { processed: true, previousResponse: { error: 'Idempotency check failed - blocked for safety' } };
  }
}

/**
 * Mark webhook as processed
 *
 * @param service - Service name
 * @param webhookId - Unique webhook identifier
 * @param brand - Optional brand identifier
 * @param requestBody - Request body
 * @param response - Response to store
 * @returns Success boolean
 */
export async function markWebhookProcessed(
  service: 'heygen' | 'submagic' | 'stripe' | 'gohighlevel',
  webhookId: string,
  brand?: string,
  requestBody?: unknown,
  response?: unknown
): Promise<boolean> {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.warn('⚠️  Firebase Admin not initialized - skipping idempotency mark');
      return false;
    }
    const key = generateIdempotencyKey(service, webhookId, brand);
    const now = Date.now();
    const expiresAt = now + (IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);

    const record: IdempotencyRecord = {
      id: key,
      service,
      brand,
      webhookId,
      processedAt: now,
      expiresAt,
      requestHash: requestBody ? hashRequest(requestBody) : '',
      response,
    };

    await db.collection(IDEMPOTENCY_COLLECTION).doc(key).set(record);

    console.log(`📝 Marked webhook ${key} as processed (expires in ${IDEMPOTENCY_TTL_HOURS}h)`);
    return true;
  } catch (error) {
    console.error('Error marking webhook as processed:', error);
    return false;
  }
}

/**
 * Clean up expired idempotency records
 * Should be called by a cron job
 *
 * @returns Number of records deleted
 */
export async function cleanupExpiredIdempotencyRecords(): Promise<number> {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.warn('⚠️  Firebase Admin not initialized - skipping cleanup');
      return 0;
    }
    const now = Date.now();

    const snapshot = await db
      .collection(IDEMPOTENCY_COLLECTION)
      .where('expiresAt', '<', now)
      .get();

    if (snapshot.empty) {
      console.log('No expired idempotency records to clean up');
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`🗑️  Cleaned up ${snapshot.size} expired idempotency records`);
    return snapshot.size;
  } catch (error) {
    console.error('Error cleaning up idempotency records:', error);
    return 0;
  }
}

/**
 * Get idempotency statistics
 *
 * @param service - Optional service filter
 * @param brand - Optional brand filter
 * @returns Statistics object
 */
export async function getIdempotencyStats(
  service?: string,
  brand?: string
): Promise<{
  total: number;
  byService: Record<string, number>;
  byBrand: Record<string, number>;
  oldestRecord: number;
  newestRecord: number;
}> {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.warn('⚠️  Firebase Admin not initialized');
      return { total: 0, byService: {}, byBrand: {}, oldestRecord: 0, newestRecord: 0 };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = db.collection(IDEMPOTENCY_COLLECTION);

    if (service) {
      query = query.where('service', '==', service);
    }

    if (brand) {
      query = query.where('brand', '==', brand);
    }

    const snapshot = await query.get();
    const records = snapshot.docs.map((doc) => doc.data() as IdempotencyRecord);

    const stats = {
      total: records.length,
      byService: {} as Record<string, number>,
      byBrand: {} as Record<string, number>,
      oldestRecord: records.length > 0 ? Math.min(...records.map(r => r.processedAt)) : 0,
      newestRecord: records.length > 0 ? Math.max(...records.map(r => r.processedAt)) : 0,
    };

    // Count by service
    records.forEach((record) => {
      const svc = record.service || 'unknown';
      stats.byService[svc] = (stats.byService[svc] || 0) + 1;

      if (record.brand) {
        stats.byBrand[record.brand] = (stats.byBrand[record.brand] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('Error getting idempotency stats:', error);
    return {
      total: 0,
      byService: {},
      byBrand: {},
      oldestRecord: 0,
      newestRecord: 0,
    };
  }
}

/**
 * Delete a specific idempotency record
 *
 * @param service - Service name
 * @param webhookId - Webhook identifier
 * @param brand - Optional brand
 * @returns Success boolean
 */
export async function deleteIdempotencyRecord(
  service: string,
  webhookId: string,
  brand?: string
): Promise<boolean> {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.warn('⚠️  Firebase Admin not initialized - skipping delete');
      return false;
    }
    const key = generateIdempotencyKey(service, webhookId, brand);
    await db.collection(IDEMPOTENCY_COLLECTION).doc(key).delete();
    console.log(`🗑️  Deleted idempotency record: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting idempotency record:', error);
    return false;
  }
}
