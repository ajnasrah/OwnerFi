/**
 * Check Personal Video Workflow Status
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function checkStatus() {
  const db = await getAdminDb();

  console.log('\n📹 Personal Video Workflows\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const snapshot = await db.collection('personal_workflow_queue')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (snapshot.empty) {
    console.log('No workflows found in personal_workflow_queue');
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Workflow ID: ${doc.id}`);
    console.log(`  Status: ${data.status || 'unknown'}`);
    console.log(`  File: ${data.fileName || 'unknown'}`);
    console.log(`  Created: ${new Date(data.createdAt).toLocaleString()}`);
    console.log(`  Temp URL: ${data.tempVideoUrl ? 'Yes' : 'No'}`);
    console.log(`  Submagic ID: ${data.submagicProjectId || 'Not started'}`);
    console.log(`  Final URL: ${data.finalVideoUrl || 'Not ready'}`);
    console.log(`  Late Post: ${data.latePostId || 'Not posted'}`);
    if (data.error) {
      console.log(`  ❌ Error: ${data.error}`);
    }
    console.log('');
  });
}

checkStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
