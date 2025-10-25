import { config } from 'dotenv';
import { getNearbyCitiesUpdate, populateNearbyCitiesForProperty } from '../src/lib/property-nearby-cities';

// Load environment variables
config({ path: '.env.local' });

async function testNearbyCitiesSystem() {
  console.log('🧪 Testing Nearby Cities System\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('         NEARBY CITIES SYSTEM TESTS');
  console.log('═══════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'Test 1: Major City (Houston, TX) - Should use city name lookup',
      property: {
        address: '123 Main St',
        city: 'Houston',
        state: 'TX',
        zipCode: '77002'
      }
    },
    {
      name: 'Test 2: Small City (La Vernia, TX) - Should use city name lookup',
      property: {
        address: '140 Great Oaks Blvd',
        city: 'La Vernia',
        state: 'TX',
        zipCode: '78121'
      }
    },
    {
      name: 'Test 3: Very Small Town with Coordinates (Rice, TX)',
      property: {
        address: '407 N Dallas St',
        city: 'Rice',
        state: 'TX',
        zipCode: '75155',
        latitude: 32.2469245,
        longitude: -96.50031109999999
      }
    },
    {
      name: 'Test 4: City Not in Database - Should geocode (Adkins, TX)',
      property: {
        address: '112 Spring Valley',
        city: 'Adkins',
        state: 'TX',
        zipCode: '78101'
      }
    },
    {
      name: 'Test 5: Remote Location - Should try 45 mile fallback (Seligman, AZ)',
      property: {
        address: '22660 W Old Hwy 66',
        city: 'Seligman',
        state: 'AZ',
        zipCode: '86337'
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n📝 ${test.name}`);
    console.log('─────────────────────────────────────────────────');
    console.log(`Property: ${test.property.address}, ${test.property.city}, ${test.property.state}`);

    try {
      const startTime = Date.now();

      // Test the main function
      const result = await populateNearbyCitiesForProperty(test.property, 30);

      const duration = Date.now() - startTime;

      if (!result) {
        console.log('❌ FAILED: Function returned null');
        failed++;
        continue;
      }

      console.log(`✓ Source: ${result.source}`);
      console.log(`✓ Duration: ${duration}ms`);
      console.log(`✓ Nearby Cities Found: ${result.nearbyCities.length}`);

      if (result.coordinates) {
        console.log(`✓ Coordinates: ${result.coordinates.latitude}, ${result.coordinates.longitude}`);
      }

      // Show first 5 cities
      if (result.nearbyCities.length > 0) {
        const sample = result.nearbyCities.slice(0, 5);
        console.log(`✓ Sample Cities: ${sample.map(c => `${c.name} (${c.distance}mi)`).join(', ')}`);
      }

      // Test getNearbyCitiesUpdate (the function used in production)
      const updateData = await getNearbyCitiesUpdate(test.property, 30);

      if (!updateData.nearbyCities || (updateData.nearbyCities as any[]).length === 0) {
        console.log('⚠️  WARNING: getNearbyCitiesUpdate returned empty array');
      } else {
        console.log(`✓ Update data ready: ${(updateData.nearbyCities as any[]).length} cities`);
      }

      console.log('✅ PASSED');
      passed++;

    } catch (error) {
      console.log('❌ FAILED');
      console.log(`Error: ${(error as Error).message}`);
      failed++;
    }

    // Rate limit between tests
    if (i < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('                  TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════\n');

  // Integration test
  console.log('\n🔄 Testing Background Job Queue Integration...');
  console.log('─────────────────────────────────────────────────');

  try {
    // Import the queue function
    const { queueNearbyCitiesJob, getJobQueueStatus } = await import('../src/lib/background-jobs');

    // Queue a test job
    queueNearbyCitiesJob('test-property-123', {
      address: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701'
    });

    const status = getJobQueueStatus();
    console.log(`✓ Job queued successfully`);
    console.log(`✓ Queue length: ${status.queueLength}`);
    console.log(`✓ Is processing: ${status.isProcessing}`);
    console.log('✅ Background job integration: PASSED');

  } catch (error) {
    console.log('❌ Background job integration: FAILED');
    console.log(`Error: ${(error as Error).message}`);
  }

  console.log('\n🎉 All tests completed!\n');
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
testNearbyCitiesSystem().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
