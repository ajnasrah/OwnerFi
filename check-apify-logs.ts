import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkApifyLogs() {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY is required');
  }

  console.log('=== CHECKING APIFY ACTIVITY LOGS ===\n');
  
  try {
    // Get recent runs from Apify API
    const response = await fetch('https://api.apify.com/v2/actor-runs?limit=20&desc=true', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.data.items.length} recent runs\n`);
    
    // Filter for today's runs
    const today = new Date().toISOString().split('T')[0];
    const todayRuns = data.data.items.filter((run: any) => 
      run.startedAt && run.startedAt.startsWith(today)
    );
    
    console.log(`Runs from today (${today}): ${todayRuns.length}\n`);
    
    if (todayRuns.length === 0) {
      console.log('❌ No Apify runs found from today');
      console.log('This suggests the one-time script never started or failed immediately\n');
    }
    
    // Show recent runs with details
    console.log('Recent Apify runs:');
    data.data.items.slice(0, 10).forEach((run: any, i: number) => {
      const startTime = run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Never started';
      const endTime = run.finishedAt ? new Date(run.finishedAt).toLocaleString() : 'Still running';
      const duration = run.finishedAt && run.startedAt ? 
        Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000) : 'N/A';
      
      console.log(`${i + 1}. ${run.id}`);
      console.log(`   Actor: ${run.actId}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   Started: ${startTime}`);
      console.log(`   Finished: ${endTime}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Exit code: ${run.exitCode || 'N/A'}`);
      
      // Highlight today's runs
      if (run.startedAt && run.startedAt.startsWith(today)) {
        console.log(`   🟡 TODAY'S RUN`);
      }
      console.log('');
    });
    
    // Get specific actor usage stats
    const actors = ['api-ninja/zillow-search-scraper', 'maxcopell/zillow-detail-scraper'];
    
    console.log('=== ACTOR USAGE STATS ===\n');
    
    for (const actorId of actors) {
      try {
        const actorResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?limit=5`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (actorResponse.ok) {
          const actorData = await actorResponse.json();
          console.log(`${actorId}:`);
          console.log(`  Recent runs: ${actorData.data.items.length}`);
          
          const todayActorRuns = actorData.data.items.filter((run: any) =>
            run.startedAt && run.startedAt.startsWith(today)
          );
          
          console.log(`  Today's runs: ${todayActorRuns.length}`);
          
          if (todayActorRuns.length > 0) {
            console.log(`  Today's statuses: ${todayActorRuns.map((r: any) => r.status).join(', ')}`);
          }
          console.log('');
        }
      } catch (error) {
        console.log(`  Error checking ${actorId}: ${error}`);
      }
    }
    
  } catch (error) {
    console.error('Error checking Apify:', error);
  }
}

checkApifyLogs();