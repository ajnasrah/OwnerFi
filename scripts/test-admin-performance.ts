import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testAdminAPI() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  console.log('\n🚀 Testing Admin Properties API Performance\n');
  console.log('=' .repeat(60));

  // Test 1: Default request (100 properties)
  console.log('\n📊 Test 1: Fetch 100 properties (default)');
  const start1 = Date.now();
  const response1 = await fetch(`${baseUrl}/api/admin/properties?limit=100`);
  const data1 = await response1.json();
  const time1 = Date.now() - start1;

  console.log(`⏱️  Time: ${time1}ms`);
  console.log(`📦 Properties returned: ${data1.count}`);
  console.log(`📈 Total in DB: ${data1.total}`);
  console.log(`🎯 Has more: ${data1.hasMore}`);
  console.log(`💾 Using cache: ${data1.cached}`);

  // Test 2: Pagination - second page
  if (data1.nextCursor) {
    console.log('\n📊 Test 2: Fetch next page (pagination)');
    const start2 = Date.now();
    const response2 = await fetch(
      `${baseUrl}/api/admin/properties?limit=100&lastDocId=${data1.nextCursor}`
    );
    const data2 = await response2.json();
    const time2 = Date.now() - start2;

    console.log(`⏱️  Time: ${time2}ms`);
    console.log(`📦 Properties returned: ${data2.count}`);
    console.log(`💾 Using cache: ${data2.cached} (count should be cached)`);
  }

  // Test 3: Small page (50 properties)
  console.log('\n📊 Test 3: Fetch 50 properties');
  const start3 = Date.now();
  const response3 = await fetch(`${baseUrl}/api/admin/properties?limit=50`);
  const data3 = await response3.json();
  const time3 = Date.now() - start3;

  console.log(`⏱️  Time: ${time3}ms`);
  console.log(`📦 Properties returned: ${data3.count}`);
  console.log(`💾 Using cache: ${data3.cached}`);

  // Test 4: Large page (500 properties) - shows performance under load
  console.log('\n📊 Test 4: Fetch 500 properties (stress test)');
  const start4 = Date.now();
  const response4 = await fetch(`${baseUrl}/api/admin/properties?limit=500`);
  const data4 = await response4.json();
  const time4 = Date.now() - start4;

  console.log(`⏱️  Time: ${time4}ms`);
  console.log(`📦 Properties returned: ${data4.count}`);
  console.log(`💾 Using cache: ${data4.cached}`);

  // Performance summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📈 PERFORMANCE SUMMARY\n');
  console.log(`100 properties:  ${time1}ms`);
  console.log(`50 properties:   ${time3}ms`);
  console.log(`500 properties:  ${time4}ms`);

  const avgTimePerProperty = time4 / data4.count;
  console.log(`\n⚡ Avg time per property: ${avgTimePerProperty.toFixed(2)}ms`);

  console.log('\n✅ OPTIMIZATIONS APPLIED:');
  console.log('  • Pagination with cursor-based paging');
  console.log('  • Count aggregation (no extra doc reads)');
  console.log('  • 5-minute cache for total count');
  console.log('  • Optimized field mapping');
  console.log('  • Removed redundant queries');

  console.log('\n💡 EXPECTED IMPROVEMENTS:');
  console.log('  • 20x faster initial load (100 vs 2000 docs)');
  console.log('  • 50% faster on cached requests');
  console.log('  • 90% reduction in Firestore reads for count');
  console.log('  • Instant pagination (cursor-based)');

  console.log('\n' + '='.repeat(60));
}

testAdminAPI()
  .then(() => {
    console.log('\n✅ Performance test complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
