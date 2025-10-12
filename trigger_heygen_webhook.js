// Manually trigger HeyGen webhook to continue the workflow

async function triggerWebhook() {
  console.log('🔔 Manually triggering HeyGen webhook...\n');

  const response = await fetch('http://localhost:3000/api/webhooks/heygen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'avatar_video.success',
      event_data: {
        video_id: '2dcdb3a4c6a347988334fb8ef90ee7da',
        video_url: 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/2dcdb3a4c6a347988334fb8ef90ee7da.mp4?Expires=1760826433&Signature=Nk95nRSU3fb9G1ODUyAxXxunmoAuzsNvrd6OsHijPX1mpPS35QN~bFWV8zaMuTETrmXWtgHZK3Uuyf3LM783gn~pQpfzRFmDmFIlzwv~Ev3wBtv8SWgDIpZsKyqgB3M0VpGATYegkuF98u9mNDSoNJIfaNSykbS4WKW1x2twM9tHEHoYrt-xkrLyVE~fnJes04JapuIgsydXWOQK8e9HbHrEZOMAvpgw8MJLuELjbnHq2VsXk9eAqSNj2j1JF5Y9eKP3aTlRieyLIMHa~jiRen8HLYrqyiIbC550ZcxomVuHtto8wCUc~V3k2iFr9wEwi-Nhq~VDbN3tdUYF-jP5BA__&Key-Pair-Id=K38HBHX5LX3X2H',
        duration: 55.108,
        callback_id: '08a5fe1f-0aad-4466-a651-aff85b583691'
      }
    })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✅ HeyGen webhook triggered successfully!');
    console.log('   Response:', JSON.stringify(data, null, 2));
    console.log('\n📤 Video sent to Submagic for captions...\n');
  } else {
    const error = await response.text();
    console.error('❌ Failed:', error);
  }
}

triggerWebhook();
