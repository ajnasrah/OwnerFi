import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function checkWorkflow() {
  const workflowId = 'wf_1763994488480_wzes2rttp';
  const doc = await db.collection('carz_workflow_queue').doc(workflowId).get();

  if (!doc.exists) {
    console.log('❌ Workflow not found!');
    return;
  }

  const data = doc.data();
  console.log('✅ Workflow found:');
  console.log('   Status:', data?.status);
  console.log('   Current Step:', data?.currentStep || 'N/A');
  console.log('   Article:', (data?.article?.title || 'N/A').substring(0, 60));
  console.log('   Created:', data?.createdAt?.toDate?.() || 'N/A');
  console.log('   HeyGen ID:', data?.heygenVideoId || 'Not yet');
  console.log('   Post ID:', data?.latePostId || 'Not yet');
  if (data?.error) console.log('   Error:', data.error);

  // Also check last few workflows
  console.log('\n=== Last 3 Carz Workflows ===\n');
  const recent = await db.collection('carz_workflow_queue')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();

  recent.docs.forEach((doc, i) => {
    const d = doc.data();
    console.log(`${i+1}. ${doc.id.substring(0, 20)}...`);
    console.log(`   Status: ${d.status}`);
    console.log(`   Created: ${d.createdAt?.toDate?.() || 'N/A'}`);
    if (d.latePostId) console.log(`   Posted: ${d.latePostId}`);
    console.log('');
  });
}

checkWorkflow().catch(console.error);
