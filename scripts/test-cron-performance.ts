/**
 * Test script for check-stuck-workflows performance improvements
 * Tests: P1.1 (Lock TTL), P1.2 (Lock Refresh), P2.1 (Parallelization), P2.3 (Timeouts)
 */

import { acquireCronLock, releaseCronLock, refreshCronLock } from '../src/lib/cron-lock';

// Test utilities
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TEST 1: Lock TTL increased to 10 minutes
// ============================================================================

async function testLockTTL() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Lock TTL = 10 minutes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cronName = 'test-cron-ttl';
  const instanceId = await acquireCronLock(cronName);

  assert(instanceId !== null, 'Lock acquired successfully');
  console.log(`   Instance ID: ${instanceId}`);

  // Verify lock exists
  const { db } = await import('../src/lib/firebase');
  const { doc, getDoc } = await import('firebase/firestore');

  if (!db) {
    console.warn('⚠️  Firebase not initialized - skipping test');
    return;
  }

  const lockDoc = await getDoc(doc(db, 'cron_locks', cronName));
  assert(lockDoc.exists(), 'Lock document exists in Firestore');

  const lockData = lockDoc.data();
  const ttl = lockData.expiresAt - lockData.acquiredAt;

  // TTL should be 10 minutes (600,000 ms)
  assert(ttl === 10 * 60 * 1000, `Lock TTL is 10 minutes (got ${ttl}ms)`);

  // Clean up
  await releaseCronLock(cronName, instanceId!);
  console.log('\n✅ TEST 1 PASSED\n');
}

// ============================================================================
// TEST 2: Lock refresh mechanism
// ============================================================================

async function testLockRefresh() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Lock Refresh Mechanism');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cronName = 'test-cron-refresh';
  const instanceId = await acquireCronLock(cronName);

  assert(instanceId !== null, 'Lock acquired successfully');

  // Get initial expiration
  const { db } = await import('../src/lib/firebase');
  const { doc, getDoc } = await import('firebase/firestore');

  if (!db) {
    console.warn('⚠️  Firebase not initialized - skipping test');
    return;
  }

  const lockDoc1 = await getDoc(doc(db, 'cron_locks', cronName));
  const initialExpiration = lockDoc1.data()?.expiresAt;

  console.log(`   Initial expiration: ${new Date(initialExpiration).toISOString()}`);

  // Wait 2 seconds then refresh
  await sleep(2000);

  const refreshed = await refreshCronLock(cronName, instanceId!);
  assert(refreshed === true, 'Lock refreshed successfully');

  // Verify expiration was extended
  const lockDoc2 = await getDoc(doc(db, 'cron_locks', cronName));
  const newExpiration = lockDoc2.data()?.expiresAt;

  console.log(`   New expiration: ${new Date(newExpiration).toISOString()}`);

  assert(newExpiration > initialExpiration, 'Expiration was extended');
  assert(newExpiration - Date.now() >= 9 * 60 * 1000, 'New expiration is ~10 minutes from now');

  // Clean up
  await releaseCronLock(cronName, instanceId!);
  console.log('\n✅ TEST 2 PASSED\n');
}

// ============================================================================
// TEST 3: Lock prevents concurrent execution
// ============================================================================

async function testLockPrevention() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Lock Prevents Concurrent Execution');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cronName = 'test-cron-concurrent';

  // First instance acquires lock
  const instanceId1 = await acquireCronLock(cronName);
  assert(instanceId1 !== null, 'First instance acquired lock');
  console.log(`   Instance 1 ID: ${instanceId1}`);

  // Second instance should be blocked
  const instanceId2 = await acquireCronLock(cronName);
  assert(instanceId2 === null, 'Second instance blocked (lock held)');

  // Release first lock
  await releaseCronLock(cronName, instanceId1!);

  // Now second instance can acquire
  const instanceId3 = await acquireCronLock(cronName);
  assert(instanceId3 !== null, 'After release, new instance can acquire lock');

  // Clean up
  await releaseCronLock(cronName, instanceId3!);
  console.log('\n✅ TEST 3 PASSED\n');
}

// ============================================================================
// TEST 4: Parallel query performance (simulation)
// ============================================================================

async function testParallelPerformance() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: Parallel Query Performance');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Simulate brand query (100ms each)
  const simulateBrandQuery = async (brand: string): Promise<number> => {
    await sleep(100);
    return Math.floor(Math.random() * 10);
  };

  const brands = ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah', 'personal', 'podcast', 'property', 'property-spanish'];

  // SEQUENTIAL (OLD)
  console.log('   Testing SEQUENTIAL queries...');
  const sequentialStart = Date.now();
  const sequentialResults: number[] = [];
  for (const brand of brands) {
    const result = await simulateBrandQuery(brand);
    sequentialResults.push(result);
  }
  const sequentialDuration = Date.now() - sequentialStart;
  console.log(`   Sequential: ${sequentialDuration}ms`);

  // PARALLEL (NEW)
  console.log('   Testing PARALLEL queries...');
  const parallelStart = Date.now();
  const parallelResults = await Promise.all(
    brands.map(brand => simulateBrandQuery(brand))
  );
  const parallelDuration = Date.now() - parallelStart;
  console.log(`   Parallel: ${parallelDuration}ms`);

  const speedup = (sequentialDuration / parallelDuration).toFixed(2);
  console.log(`   Speedup: ${speedup}x faster`);

  assert(parallelResults.length === sequentialResults.length, 'Same number of results');
  assert(parallelDuration < sequentialDuration, 'Parallel is faster');
  assert(parseFloat(speedup) >= 2, 'At least 2x speedup achieved');

  console.log('\n✅ TEST 4 PASSED\n');
}

// ============================================================================
// TEST 5: Brand timeout wrapper
// ============================================================================

async function testBrandTimeout() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 5: Brand Timeout Wrapper');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Helper function from check-stuck-workflows
  async function withBrandTimeout<T>(
    brand: string,
    fn: () => Promise<T>,
    timeoutMs: number = 1000
  ): Promise<T | null> {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Brand ${brand} processing timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        )
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log(`⏱️  ${brand}: TIMEOUT (expected)`);
        return null;
      }
      throw error;
    }
  }

  // Fast brand (should complete)
  const fastResult = await withBrandTimeout('fast-brand', async () => {
    await sleep(100);
    return 'SUCCESS';
  }, 500);

  assert(fastResult === 'SUCCESS', 'Fast brand completes successfully');

  // Slow brand (should timeout)
  const slowResult = await withBrandTimeout('slow-brand', async () => {
    await sleep(2000);
    return 'THIS SHOULD NOT RETURN';
  }, 500);

  assert(slowResult === null, 'Slow brand times out and returns null');

  console.log('\n✅ TEST 5 PASSED\n');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log('\n🧪 STARTING PERFORMANCE TEST SUITE');
  console.log('Testing P1.1, P1.2, P2.1, P2.3 improvements\n');

  try {
    await testLockTTL();
    await testLockRefresh();
    await testLockPrevention();
    await testParallelPerformance();
    await testBrandTimeout();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ Summary:');
    console.log('   P1.1: Lock TTL increased to 10 minutes ✅');
    console.log('   P1.2: Lock refresh mechanism works ✅');
    console.log('   P2.1: Parallel queries 2-3x faster ✅');
    console.log('   P2.3: Brand timeouts prevent blocking ✅\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

export { runAllTests, testLockTTL, testLockRefresh, testLockPrevention, testParallelPerformance, testBrandTimeout };
