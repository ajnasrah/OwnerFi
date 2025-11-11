// Quick trigger for Property and Podcast

async function trigger() {
  console.log('🎬 Triggering Final Videos\n');

  // Property
  console.log('📹 Property...');
  const propRes = await fetch('https://ownerfi.ai/api/property/video-cron', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer 418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da'
    }
  });
  const propData = await propRes.json();
  console.log(JSON.stringify(propData, null, 2));

  console.log('\n📹 Podcast...');
  const podRes = await fetch('https://ownerfi.ai/api/podcast/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestType: 'business_owner' })
  });
  const podData = await podRes.json();
  console.log(JSON.stringify(podData, null, 2));
}

trigger();
