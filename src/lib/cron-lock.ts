/**
 * Cron Job Locking Mechanism
 * Prevents concurrent execution of the same cron job using Firestore
 *
 * CRITICAL: Uses Firestore transactions for atomic lock acquisition
 * to prevent race conditions where two processes acquire the lock simultaneously.
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';

const LOCK_COLLECTION = 'cron_locks';
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes (increased from 5 to prevent expiration during long-running crons)
const LOCK_REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (refresh lock every 2 minutes to prevent expiration)

export interface CronLock {
  cronName: string;
  acquiredAt: number;
  expiresAt: number;
  instanceId: string;
  lastRefreshedAt?: number; // Track when lock was last refreshed
}

/**
 * Generate a unique instance ID for this execution
 */
function generateInstanceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Attempt to acquire a lock for a cron job using atomic transaction
 * Returns the instanceId if successful, null if lock is held by another process
 *
 * CRITICAL: Uses Firestore transaction to prevent race conditions where
 * two processes both see no lock and both proceed to acquire it.
 */
export async function acquireCronLock(cronName: string): Promise<string | null> {
  if (!db) {
    console.warn('⚠️  Firebase not initialized, skipping lock (blocking execution for safety)');
    return null; // DON'T allow execution if Firebase unavailable - could cause duplicates
  }

  const lockRef = doc(db, LOCK_COLLECTION, cronName);
  const instanceId = generateInstanceId();

  try {
    // Use transaction for ATOMIC read-then-write operation
    // This prevents race conditions where two processes both see no lock
    const acquired = await runTransaction(db, async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      const now = Date.now();

      if (lockDoc.exists()) {
        const existingLock = lockDoc.data() as CronLock;

        // Check if lock has expired
        if (existingLock.expiresAt > now) {
          console.log(`🔒 Cron "${cronName}" is locked by instance ${existingLock.instanceId}`);
          console.log(`   Lock expires in ${Math.round((existingLock.expiresAt - now) / 1000)}s`);
          return false; // Lock is held by another process
        }

        console.log(`♻️  Existing lock for "${cronName}" has expired, acquiring new lock`);
      }

      // Acquire lock atomically within the transaction
      const lock: CronLock = {
        cronName,
        acquiredAt: now,
        expiresAt: now + LOCK_TTL_MS,
        instanceId
      };

      transaction.set(lockRef, lock);
      return true;
    });

    if (acquired) {
      console.log(`✅ Acquired lock for cron "${cronName}" (instance: ${instanceId})`);
      return instanceId;
    } else {
      return null;
    }

  } catch (error) {
    console.error(`❌ Error acquiring lock for "${cronName}":`, error);
    // CRITICAL: Do NOT allow execution on error - could cause duplicates
    // Better to skip a cron run than to run duplicates
    return null;
  }
}

/**
 * Refresh a cron lock to extend its expiration time
 * This prevents the lock from expiring during long-running cron jobs
 */
export async function refreshCronLock(cronName: string, instanceId: string): Promise<boolean> {
  if (!db) {
    return false; // Skip if Firebase not initialized
  }

  const lockRef = doc(db, LOCK_COLLECTION, cronName);

  try {
    // Verify we own the lock before refreshing
    const lockDoc = await getDoc(lockRef);

    if (lockDoc.exists()) {
      const existingLock = lockDoc.data() as CronLock;

      if (existingLock.instanceId === instanceId) {
        // Extend expiration time
        const updatedLock: CronLock = {
          ...existingLock,
          expiresAt: Date.now() + LOCK_TTL_MS,
          lastRefreshedAt: Date.now()
        };

        await setDoc(lockRef, updatedLock);
        console.log(`🔄 Refreshed lock for cron "${cronName}" (instance: ${instanceId})`);
        return true;
      } else {
        console.warn(`⚠️  Cannot refresh lock for "${cronName}" - owned by different instance`);
        return false;
      }
    }

    console.warn(`⚠️  Cannot refresh lock for "${cronName}" - lock not found`);
    return false;
  } catch (error) {
    console.error(`❌ Error refreshing lock for "${cronName}":`, error);
    return false;
  }
}

/**
 * Release a cron lock
 */
export async function releaseCronLock(cronName: string, instanceId: string): Promise<void> {
  if (!db) {
    return; // Skip if Firebase not initialized
  }

  const lockRef = doc(db, LOCK_COLLECTION, cronName);

  try {
    // Verify we own the lock before releasing
    const lockDoc = await getDoc(lockRef);

    if (lockDoc.exists()) {
      const existingLock = lockDoc.data() as CronLock;

      if (existingLock.instanceId === instanceId) {
        await deleteDoc(lockRef);
        console.log(`🔓 Released lock for cron "${cronName}" (instance: ${instanceId})`);
      } else {
        console.warn(`⚠️  Cannot release lock for "${cronName}" - owned by different instance`);
      }
    }
  } catch (error) {
    console.error(`❌ Error releasing lock for "${cronName}":`, error);
  }
}

/**
 * Execute a function with automatic lock acquisition and release
 * Includes automatic lock refresh to prevent expiration during long-running operations
 */
export async function withCronLock<T>(
  cronName: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const instanceId = await acquireCronLock(cronName);

  if (!instanceId) {
    console.log(`⏭️  Skipping "${cronName}" - another instance is running`);
    return null;
  }

  // Set up automatic lock refresh to prevent expiration during long-running crons
  let refreshInterval: NodeJS.Timeout | null = null;
  let isExecuting = true;

  // Start lock refresh timer
  refreshInterval = setInterval(async () => {
    if (isExecuting) {
      const refreshed = await refreshCronLock(cronName, instanceId);
      if (!refreshed) {
        console.error(`❌ Failed to refresh lock for "${cronName}" - lock may have been stolen`);
        // Clear interval since we no longer own the lock
        if (refreshInterval) clearInterval(refreshInterval);
      }
    }
  }, LOCK_REFRESH_INTERVAL_MS);

  try {
    const result = await fn();
    return result;
  } finally {
    isExecuting = false;

    // Clear refresh interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Release lock
    await releaseCronLock(cronName, instanceId);
  }
}
