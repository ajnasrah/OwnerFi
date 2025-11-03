// Trigger Abdullah video
async function trigger() {
  console.log('📹 Triggering Abdullah Video...\n');

  const res = await fetch('https://ownerfi.ai/api/workflow/complete-abdullah', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 1 })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  if (data.workflowIds) {
    console.log(`\n✅ Abdullah workflows: ${data.workflowIds.join(', ')}`);
  }
}

trigger();
