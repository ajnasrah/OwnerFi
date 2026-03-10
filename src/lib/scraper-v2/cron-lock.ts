/**
 * Cron Lock (Firebase Admin SDK)
 *
 * Prevents concurrent execution of cron jobs using Firestore.
 * Used by all cron routes for atomic lock acquisition.
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

/**
 * Execute a function with automatic lock acquisition and release.
 * Returns null if lock could not be acquired (another instance running).
 */
export async function withCronLock<T>(
  cronName: string,
  fn: () => Promise<T>
): Promise<T | null> {
  let instanceId: string | null;

  try {
    instanceId = await acquireCronLock(cronName);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[LOCK] Lock system failed for "${cronName}":`, msg);
    return null;
  }

  if (!instanceId) {
    return null;
  }

  try {
    const result = await fn();
    return result;
  } finally {
    await releaseCronLock(cronName, instanceId);
  }
}

/**
 * Same as withCronLock but returns a richer result object.
 * Used by v2/scraper/run for detailed lock status reporting.
 */
export async function withScraperLock<T>(
  cronName: string,
  fn: () => Promise<T>
): Promise<{ result: T; locked: false } | { result: null; locked: true; error?: string }> {
  let instanceId: string | null;

  try {
    instanceId = await acquireCronLock(cronName);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[LOCK] Lock system failed for "${cronName}":`, msg);
    return { result: null, locked: true, error: msg };
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
