import fetch from 'node-fetch';

async function triggerCronBurst() {
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  
  console.log('🚀 Triggering cron burst to clear backlog...\n');
  
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  let totalProcessed = 0;
  
  for (let i = 1; i <= 20; i++) {
    console.log(`\n📍 Trigger #${i}/20:`);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/cron/refresh-zillow-status-fixed`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
        timeout: 300000, // 5 minutes
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const data = await response.json();
      
      if (response.ok) {
        if (data.skipped) {
          console.log(`   ⏭️ SKIPPED - Another instance running`);
          skipCount++;
          
          // If skipped, wait 30 seconds for the current run to finish
          if (i < 20) {
            console.log(`   ⏳ Waiting 30s for current run to complete...`);
            await new Promise(resolve => setTimeout(resolve, 30000));
          }
        } else {
          successCount++;
          const processed = data.stats?.processed || 0;
          totalProcessed += processed;
          
          console.log(`   ✅ SUCCESS in ${duration}s`);
          console.log(`      Processed: ${processed}`);
          console.log(`      Updated: ${data.stats?.updated || 0}`);
          console.log(`      Deleted: ${data.stats?.deleted || 0}`);
          console.log(`      Deactivated: ${data.stats?.deactivated || 0}`);
          
          // Short wait between successful runs
          if (i < 20) {
            console.log(`   ⏳ Waiting 2s before next trigger...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } else {
        console.error(`   ❌ FAILED: ${data.error || 'Unknown error'}`);
        failCount++;
        
        // Wait a bit before retry on failure
        if (i < 20) {
          console.log(`   ⏳ Waiting 5s before retry...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}`);
      failCount++;
      
      if (error.message.includes('ETIMEDOUT')) {
        console.log(`   ⏰ Timeout - likely still processing, waiting 1 minute...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BURST SUMMARY:');
  console.log('='.repeat(60));
  console.log(`✅ Successful runs: ${successCount}/20`);
  console.log(`⏭️  Skipped runs:    ${skipCount}/20`);
  console.log(`❌ Failed runs:     ${failCount}/20`);
  console.log(`📈 Total properties processed: ${totalProcessed}`);
  
  if (totalProcessed > 0) {
    console.log(`\n✨ Successfully processed ${totalProcessed} properties!`);
  }
  
  process.exit(0);
}

triggerCronBurst().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});