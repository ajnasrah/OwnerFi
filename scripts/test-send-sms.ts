import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const SID = process.env.TWILIO_ACCOUNT_SID?.trim();
  const TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
  const FROM = process.env.TWILIO_OUTREACH_NUMBER?.trim();
  const TO = '+19018319661';

  const body = 'Hi AJ, this is OwnerFi. We help buyers find owner-financed homes. Does the property at 123 Test St, Memphis offer owner financing or flexible terms? Reply YES or NO. Reply STOP to opt out.';

  console.log('Sending test SMS...');
  console.log('From:', FROM);
  console.log('To:', TO);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: TO, From: FROM!, Body: body }),
  });

  const data = await res.json();
  if (res.ok) {
    console.log('✅ SMS sent! SID:', data.sid, 'Status:', data.status);
  } else {
    console.error('❌ Failed:', data.message || JSON.stringify(data));
  }
}

main().catch(console.error);
