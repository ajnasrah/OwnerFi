/**
 * Check Submagic project status for both property videos
 */

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

const projects = [
  { id: 'af998ae2-b2ad-493e-9743-118ff319e9a1', workflow: 'property_15sec_1761445132537_l7582' },
  { id: 'abbf4210-1cde-4256-9491-2cc555cdfc5c', workflow: 'property_15sec_1761443694311_23s4a' }
];

async function checkProjects() {
  console.log('✨ Checking Submagic Project Status\n');
  console.log('='.repeat(70));

  for (const project of projects) {
    console.log(`\n📦 Project: ${project.id}`);
    console.log(`   Workflow: ${project.workflow}`);

    try {
      const response = await fetch(`https://api.submagic.co/v1/projects/${project.id}`, {
        headers: {
          'x-api-key': SUBMAGIC_API_KEY!
        }
      });

      if (!response.ok) {
        console.log(`   ❌ API Error: ${response.status}`);
        continue;
      }

      const data = await response.json();

      console.log(`   Status: ${data.status}`);
      console.log(`   Progress: ${data.progress || 'N/A'}%`);
      console.log(`   Video URL: ${data.media_url || data.video_url || 'Not ready'}`);

      if (data.status === 'completed' || data.status === 'done') {
        console.log(`   ✅ READY! Video has captions`);
      } else {
        console.log(`   ⏳ Still processing...`);
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

checkProjects().catch(console.error);
