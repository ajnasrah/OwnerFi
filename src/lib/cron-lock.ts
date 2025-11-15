/**
 * Cron Job Locking Mechanism
 * Prevents concurrent execution of the same cron job using Firestore
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

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
 * Attempt to acquire a lock for a cron job
 * Returns the instanceId if successful, null if lock is held by another process
 */
export async function acquireCronLock(cronName: string): Promise<string | null> {
  if (!db) {
    console.warn('⚠️  Firebase not initialized, skipping lock (allowing execution)');
    return generateInstanceId(); // Allow execution if Firebase unavailable
  }

  const lockRef = doc(db, LOCK_COLLECTION, cronName);
  const instanceId = generateInstanceId();

  try {
    // Check if lock exists and is still valid
    const lockDoc = await getDoc(lockRef);

    if (lockDoc.exists()) {
      const existingLock = lockDoc.data() as CronLock;

      // Check if lock has expired
      if (existingLock.expiresAt > Date.now()) {
        console.log(`🔒 Cron "${cronName}" is locked by instance ${existingLock.instanceId}`);
        return null; // Lock is held by another process
      }

      console.log(`♻️  Existing lock for "${cronName}" has expired, acquiring new lock`);
    }

    // Acquire lock
    const lock: CronLock = {
      cronName,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + LOCK_TTL_MS,
      instanceId
    };

    await setDoc(lockRef, lock);
    console.log(`✅ Acquired lock for cron "${cronName}" (instance: ${instanceId})`);

    return instanceId;
  } catch (error) {
    console.error(`❌ Error acquiring lock for "${cronName}":`, error);
    // If lock acquisition fails, allow execution to prevent blocking
    return instanceId;
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
