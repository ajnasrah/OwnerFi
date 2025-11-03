/**
 * Trigger remaining test videos (Abdullah, Podcast, Property)
 */

async function triggerVideos() {
  console.log('🎬 Triggering Remaining Test Videos\n');
  console.log('='.repeat(60));

  const results: any[] = [];

  // Abdullah
  console.log('\n📹 Triggering Abdullah video...');
  try {
    const abdullahRes = await fetch('https://ownerfi.ai/api/workflow/complete-abdullah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 })
    });

    const abdullahData = await abdullahRes.json();
    console.log('   Result:', abdullahData.message || abdullahData.error);

    if (abdullahData.workflowIds) {
      console.log('   Workflow IDs:', abdullahData.workflowIds.join(', '));
      results.push({ brand: 'abdullah', success: true, workflowIds: abdullahData.workflowIds });
    } else if (abdullahData.error) {
      results.push({ brand: 'abdullah', success: false, error: abdullahData.error });
    }
  } catch (error) {
    console.error('   Error:', error);
    results.push({ brand: 'abdullah', success: false, error: String(error) });
  }

  // Podcast
  console.log('\n📹 Triggering Podcast episode...');
  try {
    const podcastRes = await fetch('https://ownerfi.ai/api/podcast/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestType: 'financial_advisor' })
    });

    const podcastData = await podcastRes.json();
    console.log('   Result:', podcastData.message || podcastData.error);

    if (podcastData.workflowId) {
      console.log('   Workflow ID:', podcastData.workflowId);
      results.push({ brand: 'podcast', success: true, workflowId: podcastData.workflowId });
    } else if (podcastData.error) {
      results.push({ brand: 'podcast', success: false, error: podcastData.error });
    }
  } catch (error) {
    console.error('   Error:', error);
    results.push({ brand: 'podcast', success: false, error: String(error) });
  }

  // Property - Try 10 times to find valid property
  console.log('\n📹 Triggering Property video (trying multiple properties)...');
  let propertySuccess = false;

  for (let i = 1; i <= 10; i++) {
    try {
      const propertyRes = await fetch('https://ownerfi.ai/api/property/video-cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da'
        }
      });

      const propertyData = await propertyRes.json();

      if (propertyData.success && propertyData.property?.workflowId) {
        console.log(`   ✅ Attempt ${i}: Success!`);
        console.log('   Workflow ID:', propertyData.property.workflowId);
        console.log('   Address:', propertyData.property.address);
        results.push({ brand: 'property', success: true, workflowId: propertyData.property.workflowId });
        propertySuccess = true;
        break;
      } else {
        console.log(`   ❌ Attempt ${i}: ${propertyData.error || 'Validation error'}`);
        if (i < 10) {
          console.log('      Trying next property...');
          // Wait 500ms between attempts
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error(`   Error on attempt ${i}:`, error);
    }
  }

  if (!propertySuccess) {
    console.log('   ⚠️  All 10 attempts failed - property queue needs data cleanup');
    results.push({ brand: 'property', success: false, error: 'All properties in queue missing required data' });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY\n');

  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.brand.toUpperCase()}: ${r.success ? 'Triggered' : `Failed - ${r.error}`}`);
    if (r.workflowId) {
      console.log(`   Workflow: ${r.workflowId}`);
    } else if (r.workflowIds) {
      console.log(`   Workflows: ${r.workflowIds.join(', ')}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\nTotal: ${successCount}/${results.length} brands successfully triggered\n`);

  return results;
}

triggerVideos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
