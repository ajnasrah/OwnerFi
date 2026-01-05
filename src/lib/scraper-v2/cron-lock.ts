/**
 * Cron Lock for Scraper v2 (Firebase Admin SDK version)
 *
 * Prevents concurrent execution of scraper crons
 */

import { getFirebaseAdmin } from './firebase-admin';

const LOCK_COLLECTION = 'cron_locks';
const LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes (for longer scraper runs)

export interface CronLock {
  cronName: string;
  acquiredAt: number;
  expiresAt: number;
  instanceId: string;
}

function generateInstanceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export async function acquireCronLock(cronName: string): Promise<string | null> {
  const { db } = getFirebaseAdmin();
  const lockRef = db.collection(LOCK_COLLECTION).doc(cronName);
  const instanceId = generateInstanceId();

  try {
    const lockDoc = await lockRef.get();

    if (lockDoc.exists) {
      const existingLock = lockDoc.data() as CronLock;

      if (existingLock.expiresAt > Date.now()) {
        console.log(`[LOCK] Cron "${cronName}" is locked by instance ${existingLock.instanceId}`);
        return null;
      }

      console.log(`[LOCK] Existing lock for "${cronName}" has expired, acquiring new lock`);
    }

    const lock: CronLock = {
      cronName,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + LOCK_TTL_MS,
      instanceId,
    };

    await lockRef.set(lock);
    console.log(`[LOCK] Acquired lock for "${cronName}" (instance: ${instanceId})`);

    return instanceId;
  } catch (error) {
    console.error(`[LOCK] Error acquiring lock for "${cronName}":`, error);
    // Fail-fast: Don't allow execution if lock system fails
    // This prevents concurrent execution and duplicate data
    throw new Error(`Failed to acquire cron lock for "${cronName}": ${error}`);
  }
}

export async function releaseCronLock(cronName: string, instanceId: string): Promise<void> {
  const { db } = getFirebaseAdmin();
  const lockRef = db.collection(LOCK_COLLECTION).doc(cronName);

  try {
    const lockDoc = await lockRef.get();

    if (lockDoc.exists) {
      const existingLock = lockDoc.data() as CronLock;

      if (existingLock.instanceId === instanceId) {
        await lockRef.delete();
        console.log(`[LOCK] Released lock for "${cronName}"`);
      }
    }
  } catch (error) {
    console.error(`[LOCK] Error releasing lock for "${cronName}":`, error);
  }
}

export async function withScraperLock<T>(
  cronName: string,
  fn: () => Promise<T>
): Promise<{ result: T; locked: false } | { result: null; locked: true; error?: string }> {
  let instanceId: string | null;

  try {
    instanceId = await acquireCronLock(cronName);
  } catch (error: any) {
    // Lock system failure - return locked with error message
    // This prevents concurrent execution when we can't verify lock status
    console.error(`[LOCK] Lock system failed for "${cronName}":`, error.message);
    return { result: null, locked: true, error: error.message };
  }

  if (!instanceId) {
    return { result: null, locked: true };
  }

  try {
    const result = await fn();
    return { result, locked: false };
  } finally {
    await releaseCronLock(cronName, instanceId);
  }
}
