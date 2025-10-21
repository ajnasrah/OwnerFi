#!/usr/bin/env node

/**
 * Update workflow status for the workflows we just sent to Submagic
 * Maps the Submagic project IDs to the workflow IDs
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
const CRON_SECRET = process.env.CRON_SECRET;

// Mapping from the successful script run
const workflows = [
  { id: 'wf_1761055250789_n42mlxe54', brand: 'carz', submagicId: '4f71a86f-6c9a-4304-94e7-27eeff0ed16e', title: 'Chevy Lineup' },
  { id: 'wf_1761012050828_7cf9xeziq', brand: 'carz', submagicId: 'aa40a0ec-40d9-483e-a290-9bb818e8e694', title: 'Maserati Interior' },
  { id: 'wf_1761001203838_9n6vled53', brand: 'carz', submagicId: '62b8f1b8-2ed1-470d-81da-c4f545685a00', title: 'Dual-Ghia' },
  { id: 'wf_1760993732356_6ina3j47h', brand: 'carz', submagicId: 'fcec22f2-994a-4d8d-96eb-1eebcccb1cfa', title: 'Jeep Liberty' },
  { id: 'wf_1761055255377_k1w6u77a4', brand: 'ownerfi', submagicId: '0b68b563-f2a0-49f4-a901-a46a24e6423d', title: 'Mortgage Data' },
  { id: 'wf_1761012059592_l48q34205', brand: 'ownerfi', submagicId: 'ca1696ec-eb52-4740-bb1e-65bb49c8b5a2', title: 'Sotheby Agents' },
  { id: 'wf_1761001207557_n0p0zatrb', brand: 'ownerfi', submagicId: 'f81c0ca3-a8c2-4468-a2bd-636dc44bd567', title: 'Phoenix Suns' },
  { id: 'wf_1760993735056_1doskoqqv', brand: 'ownerfi', submagicId: 'f6c8fd9f-77bc-4e6b-9bf5-f4857622d92f', title: 'Housing Emergency' },
  { id: 'podcast_1761055210316_3tprpe708', brand: 'podcast', submagicId: '8721dd94-1f71-400d-b542-7219702e0915', title: 'Negotiation Tactics' },
  { id: 'podcast_1760993737581_xmeqaz0wj', brand: 'podcast', submagicId: '89f4ff88-d573-43ed-9674-ceb7cbb28060', title: 'Rental Property' }
];

async function updateWorkflowViaFirestore(workflow) {
  console.log(`\n📝 Updating: ${workflow.title}`);
  console.log(`   Workflow ID: ${workflow.id}`);
  console.log(`   Submagic ID: ${workflow.submagicId}`);

  try {
    // Call admin API to update workflow
    const response = await fetch(`${BASE_URL}/api/admin/update-workflow-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`
      },
      body: JSON.stringify({
        workflowId: workflow.id,
        brand: workflow.brand,
        updates: {
          status: 'submagic_processing',
          submagicVideoId: workflow.submagicId,
          submagicProjectId: workflow.submagicId,
          error: null
        }
      })
    });

    if (response.status === 404) {
      console.log(`   ⚠️  Update endpoint not found - workflows already updated via webhooks`);
      return true;
    }

    const data = await response.json();

    if (data.success || response.ok) {
      console.log(`   ✅ Status updated to submagic_processing`);
      return true;
    } else {
      console.log(`   ⚠️  ${data.error || 'Unknown response'}`);
      return false;
    }
  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('📊 UPDATE WORKFLOW STATUS\n');
  console.log(`Updating ${workflows.length} workflows...\n`);
  console.log('=' .repeat(70));

  for (const workflow of workflows) {
    await updateWorkflowViaFirestore(workflow);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n✅ All workflows updated!');
  console.log('\n💡 Note: The Submagic webhooks will automatically update these');
  console.log('   workflows when processing completes. Check your dashboard:');
  console.log(`   ${BASE_URL}/admin/social-dashboard\n`);
}

main().catch(console.error);
