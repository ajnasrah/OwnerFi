import fetch from 'node-fetch';

async function triggerCronMultipleTimes() {
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  
  console.log('🚀 Triggering fixed status cron 10 times...\n');
  console.log(`Using URL: ${baseUrl}/api/cron/refresh-zillow-status-fixed\n`);
  
  const results = [];
  
  for (let i = 1; i <= 10; i++) {
    console.log(`\n📍 Attempt ${i}/10:`);
    console.log('─'.repeat(50));
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/cron/refresh-zillow-status-fixed`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
        timeout: 310000, // 5+ minutes timeout
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const data = await response.json();
      
      if (response.ok) {
        if (data.skipped) {
          console.log(`⏭️  SKIPPED - Another instance running (${duration}s)`);
          results.push({ attempt: i, status: 'skipped', duration });
        } else {
          console.log(`✅ SUCCESS in ${duration}s`);
          console.log(`   Processed: ${data.stats?.processed || 0}`);
          console.log(`   Updated: ${data.stats?.updated || 0}`);
          console.log(`   Deleted: ${data.stats?.deleted || 0}`);
          console.log(`   Deactivated: ${data.stats?.deactivated || 0}`);
          console.log(`   Status Changes: ${data.stats?.statusChanged || 0}`);
          results.push({ 
            attempt: i, 
            status: 'success', 
            duration,
            processed: data.stats?.processed || 0,
            updated: data.stats?.updated || 0
          });
        }
      } else {
        console.error(`❌ FAILED with status ${response.status} (${duration}s)`);
        console.error(`   Error: ${data.error || 'Unknown error'}`);
        results.push({ 
          attempt: i, 
          status: 'failed', 
          duration,
          error: data.error 
        });
      }
      
      // Wait 2 seconds between attempts to avoid overwhelming the server
      if (i < 10) {
        console.log(`\n⏳ Waiting 2 seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ ERROR: ${error.message}`);
      results.push({ 
        attempt: i, 
        status: 'error', 
        error: error.message 
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  
  console.log(`✅ Successful: ${successful}/10`);
  console.log(`❌ Failed: ${failed}/10`);
  console.log(`⏭️  Skipped: ${skipped}/10`);
  
  const totalProcessed = results
    .filter(r => r.status === 'success')
    .reduce((sum, r) => sum + (r.processed || 0), 0);
  const totalUpdated = results
    .filter(r => r.status === 'success')
    .reduce((sum, r) => sum + (r.updated || 0), 0);
    
  console.log(`\n📈 Total properties processed: ${totalProcessed}`);
  console.log(`📝 Total properties updated: ${totalUpdated}`);
  
  // Check if cron is working
  if (successful === 0) {
    console.log('\n⚠️  WARNING: No successful runs! The cron may be broken.');
  } else if (successful < 5) {
    console.log('\n⚠️  WARNING: Less than 50% success rate. Check for issues.');
  } else {
    console.log('\n✅ Cron appears to be working correctly!');
  }
  
  process.exit(0);
}

triggerCronMultipleTimes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});