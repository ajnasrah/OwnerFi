import fetch from 'node-fetch';

async function quickTestCron() {
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  
  console.log('🚀 Quick test of cron status...\n');
  
  for (let i = 1; i <= 10; i++) {
    console.log(`Attempt ${i}/10:`);
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/cron/refresh-zillow-status-fixed`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (response.ok) {
        const data = await response.json();
        if (data.skipped) {
          console.log(`  ⏭️ SKIPPED (another instance running) - ${duration}s`);
        } else {
          console.log(`  ✅ SUCCESS - Processed ${data.stats?.processed || 0} properties in ${duration}s`);
        }
      } else {
        console.log(`  ❌ FAILED - Status ${response.status} in ${duration}s`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`  ⏰ TIMEOUT - Taking longer than 5s (likely processing)`);
      } else {
        console.log(`  ❌ ERROR - ${error.message}`);
      }
    }
    
    // Short wait between attempts
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  process.exit(0);
}

quickTestCron().catch(console.error);