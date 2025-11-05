import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

const benefitWorkflows = [
  'benefit_1761934850908_1nj4eh1o1',
  'benefit_1761924005565_tucz3pmnd',
  'benefit_1761913205581_nhr22j8hq',
  'benefit_1761902405890_eml9312fz',
  'benefit_1761859225019_tsp1a29ep',
  'benefit_1761848451069_i5gsvfpfs',
  'benefit_1761837641745_3pnz6tgvu',
  'benefit_1761826820814_97bh1u692',
  'benefit_1761816021075_7pwhmt6ri',
  'benefit_1761772806088_6q60ok5hl',
  'benefit_1761762047713_tw4rvflvw'
];

async function checkSubmagicStatus(jobId: string) {
  const url = `https://api.submagic.co/api/v1/clip/${jobId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'api-key': process.env.SUBMAGIC_API_KEY || ''
      }
    });

    const data = await response.json();
    return { jobId, status: data.status, data };
  } catch (error: any) {
    return { jobId, error: error.message };
  }
}

async function main() {
  console.log('🔍 Checking 11 stuck BENEFIT workflows\n');

  for (const workflowId of benefitWorkflows) {
    const doc = await db.collection('benefit_workflow_queue').doc(workflowId).get();
    const data = doc.data();

    if (!data) {
      console.log(`\n❌ Workflow ${workflowId} not found`);
      continue;
    }

    console.log(`\n📄 Workflow: ${workflowId}`);
    console.log(`   Title: ${data.title}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   HeyGen Video ID: ${data.heygenVideoId || 'None'}`);
    console.log(`   Submagic Job ID: ${data.submagicJobId || 'None'}`);

    if (data.submagicJobId) {
      const result = await checkSubmagicStatus(data.submagicJobId);
      console.log(`   Submagic Status: ${result.status || 'ERROR'}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.data?.video_url) {
        console.log(`   Video URL: ${result.data.video_url}`);
      }
    }
  }

  console.log('\n✅ Done checking BENEFIT workflows\n');
}

main();
