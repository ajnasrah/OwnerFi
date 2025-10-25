#!/usr/bin/env node
// Retry failed workflows

const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not set');
  process.exit(1);
}

console.log('♻️  Triggering retry of failed workflows...\n');

fetch('https://ownerfi.ai/api/workflow/retry-failed', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CRON_SECRET}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ Response:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
