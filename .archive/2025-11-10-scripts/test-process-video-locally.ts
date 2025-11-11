/**
 * Test process-video locally to see the actual error
 * This will call the actual code path and show us the real error
 */

// Set up environment
process.env.NODE_ENV = 'development';

async function testProcessVideo() {
  console.log('🧪 Testing /api/process-video locally...\n');

  const workflowId = 'property_15sec_1761450265783_gkbsi';
  const brand = 'property';

  try {
    // Import the actual route handler
    console.log('📥 Importing route handler...');
    const routeModule = await import('../src/app/api/process-video/route');

    console.log('✅ Import successful');
    console.log('   Exported functions:', Object.keys(routeModule));

    // Create a mock request
    const mockRequest = {
      json: async () => ({
        brand,
        workflowId,
        submagicProjectId: 'f7b06ba1-e52d-4710-a12b-736bd549f6dc'
      }),
      headers: {
        get: (key: string) => null
      }
    } as any;

    console.log('\n📞 Calling POST handler...');
    const response = await routeModule.POST(mockRequest);

    const result = await response.json();

    console.log('\n📊 Response:');
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      console.log('\n❌ ERROR CAUGHT:', result.error);
    } else {
      console.log('\n✅ Success!');
    }

  } catch (error) {
    console.log('\n💥 ERROR CAUGHT:');
    console.error(error);

    if (error instanceof Error) {
      console.log('\n📍 Stack trace:');
      console.log(error.stack);
    }
  }
}

testProcessVideo().catch(console.error);
