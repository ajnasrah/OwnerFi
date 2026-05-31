import fetch from 'node-fetch';

async function testStatusCron() {
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = 'http://localhost:3000';
  
  console.log('🔄 Testing fixed status cron locally...\n');
  
  try {
    const response = await fetch(`${baseUrl}/api/cron/refresh-zillow-status-fixed`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Cron executed successfully!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Cron failed:', data);
    }
  } catch (error) {
    console.error('❌ Error calling cron:', error);
  }
}

testStatusCron().catch(console.error);