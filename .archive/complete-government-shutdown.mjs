#!/usr/bin/env node
// Complete the "Government Shutdown" workflow that has completed Submagic but failed at Metricool posting

const SUBMAGIC_PROJECT_ID = '03e4ac9b-c03'; // The Submagic ID from your message (truncated, need full ID)

console.log('🎬 Completing Government Shutdown workflow...\n');
console.log('This workflow completed Submagic but failed at Metricool posting.');
console.log('The LinkedIn visibility error is now fixed in the code.\n');

// Manually trigger the Submagic webhook to retry posting
const webhookUrl = 'https://ownerfi.ai/api/webhooks/submagic';

console.log(`📡 Triggering Submagic webhook for project: ${SUBMAGIC_PROJECT_ID}...`);
console.log(`   This will retry the Metricool posting with the fixed LinkedIn config\n`);

fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: SUBMAGIC_PROJECT_ID,
    status: 'completed',
    timestamp: new Date().toISOString()
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Webhook response:', JSON.stringify(data, null, 2));
  console.log('\nThe workflow should now retry Metricool posting with the fixed LinkedIn config!');
})
.catch(err => {
  console.error('❌ Error:', err.message);
  console.log('\n⚠️  Make sure you have the full Submagic project ID.');
  console.log('   Check the workflow details to get the complete ID.');
});
