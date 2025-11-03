// Force trigger podcast with ?force=true
async function trigger() {
  console.log('📹 FORCE Triggering Podcast...\n');

  const res = await fetch('https://ownerfi.ai/api/podcast/cron?force=true', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer 418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da'
    }
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  if (data.workflowId) {
    console.log(`\n✅ Podcast workflow created: ${data.workflowId}`);
  } else if (data.error) {
    console.log(`\n❌ Error: ${data.error}`);
  }
}

trigger();
