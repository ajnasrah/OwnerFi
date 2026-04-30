import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSpecificActors() {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY is required');
  }

  console.log('=== CHECKING SPECIFIC ACTOR DETAILS ===\n');
  
  const actorIds = [
    'ENK9p4RZHg0iVso52', // Appears in logs
    'HalFSuL3WFKUxo6xp', // Appears in logs
    'api-ninja/zillow-search-scraper', // Expected
    'maxcopell/zillow-detail-scraper' // Expected
  ];
  
  for (const actorId of actorIds) {
    try {
      console.log(`Checking actor: ${actorId}`);
      
      const response = await fetch(`https://api.apify.com/v2/acts/${actorId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  Name: ${data.data.name}`);
        console.log(`  Username: ${data.data.username}`);
        console.log(`  Full ID: ${data.data.username}/${data.data.name}`);
        
        // Check recent runs
        const runsResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?limit=5`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (runsResponse.ok) {
          const runsData = await runsResponse.json();
          console.log(`  Recent runs: ${runsData.data.items.length}`);
          
          const today = new Date().toISOString().split('T')[0];
          const todayRuns = runsData.data.items.filter((run: any) =>
            run.startedAt && run.startedAt.startsWith(today)
          );
          
          console.log(`  Today's runs: ${todayRuns.length}`);
          
          if (todayRuns.length > 0) {
            const lastRun = todayRuns[0];
            console.log(`  Last run started: ${new Date(lastRun.startedAt).toLocaleString()}`);
            console.log(`  Last run status: ${lastRun.status}`);
            console.log(`  Last run duration: ${lastRun.finishedAt && lastRun.startedAt ? 
              Math.round((new Date(lastRun.finishedAt).getTime() - new Date(lastRun.startedAt).getTime()) / 1000) : 'N/A'}s`);
          }
        }
      } else {
        console.log(`  ❌ Error: ${response.status} ${response.statusText}`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`  Error: ${error}`);
      console.log('');
    }
  }
  
  // Check for any failed runs today
  console.log('=== CHECKING FOR FAILED RUNS TODAY ===\n');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch('https://api.apify.com/v2/actor-runs?limit=50&desc=true', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const todayFailedRuns = data.data.items.filter((run: any) =>
        run.startedAt && 
        run.startedAt.startsWith(today) && 
        (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT')
      );
      
      if (todayFailedRuns.length > 0) {
        console.log(`Found ${todayFailedRuns.length} failed/aborted runs today:`);
        todayFailedRuns.forEach((run: any, i: number) => {
          console.log(`${i + 1}. ${run.id} - Status: ${run.status}`);
          console.log(`   Started: ${new Date(run.startedAt).toLocaleString()}`);
          if (run.finishedAt) {
            console.log(`   Finished: ${new Date(run.finishedAt).toLocaleString()}`);
          }
          console.log('');
        });
      } else {
        console.log('✅ No failed runs today - all runs succeeded');
      }
    }
  } catch (error) {
    console.error('Error checking failed runs:', error);
  }
}

checkSpecificActors();