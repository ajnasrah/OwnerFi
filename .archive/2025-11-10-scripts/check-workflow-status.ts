/**
 * Check status of all triggered workflows
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Please set Firebase env vars in .env.local');
  process.exit(1);
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

try {
  initializeApp({
    credential: cert(serviceAccount as any),
  });
} catch (error) {
  console.log('Firebase already initialized');
}

const db = getFirestore();

const workflowIds = {
  carz: 'wf_1762188576931_hkarrk702',
  ownerfi: 'wf_1762188588058_o72koe2bh',
  vassdistro: 'wf_1762188642197_bm3uo1p0c',
  benefit: 'benefit_1762188678538_dd3tzwt2a',
};

async function checkStatus() {
  console.log('📊 Checking Workflow Status\n');
  console.log('='.repeat(80));

  for (const [brand, id] of Object.entries(workflowIds)) {
    console.log(`\n${brand.toUpperCase()}: ${id}`);
    console.log('-'.repeat(80));

    let collection: string;
    if (brand === 'benefit') collection = 'benefit_workflow_queue';
    else if (brand === 'carz') collection = 'carz_workflow_queue';
    else if (brand === 'ownerfi') collection = 'ownerfi_workflow_queue';
    else if (brand === 'vassdistro') collection = 'vassdistro_workflow_queue';
    else continue;

    const doc = await db.collection(collection).doc(id).get();

    if (!doc.exists) {
      console.log('   ❌ Not found');
      continue;
    }

    const data = doc.data();
    console.log(`   Status: ${data?.status}`);
    console.log(`   Created: ${new Date(data?.createdAt).toLocaleString()}`);

    if (data?.status === 'completed') {
      console.log(`   ✅ COMPLETED`);
      console.log(`   Platform Groups: ${data?.platformGroups || 'N/A'}`);
      console.log(`   Scheduled Platforms: ${data?.scheduledPlatforms || 'N/A'}`);
      console.log(`   Post IDs: ${data?.latePostId || 'N/A'}`);
    } else if (data?.status === 'failed') {
      console.log(`   ❌ FAILED: ${data?.error}`);
    } else {
      console.log(`   ⏳ In Progress...`);
      if (data?.heygenVideoId) console.log(`   HeyGen ID: ${data.heygenVideoId}`);
      if (data?.submagicProjectId) console.log(`   Submagic ID: ${data.submagicProjectId}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

checkStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
