#!/usr/bin/env tsx
import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('Failed to initialize admin DB');
    process.exit(1);
  }

  const doc = await adminDb.collection('benefit_workflow_queue').doc('benefit_1762539648664_1lc5qghq8').get();
  if (doc.exists) {
    const data = doc.data();
    console.log('Submagic fields:', {
      submagicVideoId: data?.submagicVideoId,
      submagicProjectId: data?.submagicProjectId
    });
    console.log('\nAll fields:', JSON.stringify(data, null, 2));
  } else {
    console.log('Doc not found');
  }
  process.exit(0);
}

main();
