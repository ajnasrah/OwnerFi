// Trigger podcast cron
async function trigger() {
  console.log('📹 Triggering Podcast Cron...\n');

  const res = await fetch('https://ownerfi.ai/api/podcast/cron', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer 418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da'
    }
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

trigger();
