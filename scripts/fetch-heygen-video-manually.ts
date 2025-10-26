/**
 * Manually fetch HeyGen video and continue workflow
 */

const WORKFLOW_ID = 'property_15sec_1761445132537_l7582';
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function fetchHeyGenVideo() {
  console.log('🔄 Manually fetching HeyGen video for workflow...\n');
  console.log(`Workflow ID: ${WORKFLOW_ID}`);

  const response = await fetch(`${baseUrl}/api/workflow/fetch-heygen-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workflowId: WORKFLOW_ID,
      brand: 'property'
    })
  });

  const data = await response.json();

  console.log('\n📊 Response:');
  console.log(JSON.stringify(data, null, 2));

  if (data.success) {
    console.log('\n✅ HeyGen video fetched and workflow updated!');
    console.log(`   Video URL: ${data.heygenVideoUrl}`);
    console.log(`   R2 URL: ${data.heygenVideoR2Url}`);
    console.log('\n   Workflow will now continue to Submagic...');
  } else {
    console.log('\n❌ Failed to fetch video');
    console.log(`   Error: ${data.error}`);
  }
}

fetchHeyGenVideo().catch(console.error);
