/**
 * Check what's in both abdullah collections
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const adminDb = getFirestore();

async function checkCollections() {
  console.log('🔍 Checking Abdullah collections...\n');

  // Check abdullah_workflow_queue
  console.log('📦 === ABDULLAH_WORKFLOW_QUEUE ===');
  const workflowSnapshot = await adminDb
    .collection('abdullah_workflow_queue')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log(`Found ${workflowSnapshot.size} recent documents`);
  workflowSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\n  ID: ${doc.id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Created: ${new Date(data.createdAt).toISOString()}`);
    console.log(`  Category: ${data.category || 'N/A'}`);
    console.log(`  Title: ${data.scriptContent?.substring(0, 60) || 'N/A'}...`);
  });

  // Check abdullah_content_queue
  console.log('\n\n📦 === ABDULLAH_CONTENT_QUEUE ===');
  const contentSnapshot = await adminDb
    .collection('abdullah_content_queue')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log(`Found ${contentSnapshot.size} recent documents`);
  contentSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\n  ID: ${doc.id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Created: ${new Date(data.createdAt).toISOString()}`);
    console.log(`  Category: ${data.category || 'N/A'}`);
    console.log(`  Content: ${data.scriptContent?.substring(0, 60) || data.content?.substring(0, 60) || 'N/A'}...`);
  });
}

checkCollections().catch(console.error);
