// Test new Abdullah cron endpoint
async function test() {
  console.log('Testing new Abdullah cron endpoint...\n');

  try {
    const res = await fetch('http://localhost:3000/api/cron/abdullah', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 418eea4a4cf7576b00b0cd85e402b649570525c055fd78386e7d989e8903d9da'
      }
    });

    console.log('Status:', res.status, res.statusText);

    const data = await res.json();
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`\n✅ ${data.theme.toUpperCase()} video created!`);
      console.log(`   Title: ${data.title}`);
      console.log(`   Workflow: ${data.workflowId}`);
      console.log(`   HeyGen: ${data.heygenVideoId}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
