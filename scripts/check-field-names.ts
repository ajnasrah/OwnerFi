#!/usr/bin/env tsx
import { getAdminDb } from '../src/lib/firebase-admin';

const CHECKS = [
  { collection: 'carz_workflow_queue', brand: 'carz' },
  { collection: 'ownerfi_workflow_queue', brand: 'ownerfi' },
  { collection: 'vassdistro_workflow_queue', brand: 'vassdistro' },
];

async function main() {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('Failed to initialize admin DB');
    process.exit(1);
  }

  for (const check of CHECKS) {
    console.log(`\n=== ${check.brand} (${check.collection}) ===`);

    const snapshot = await adminDb
      .collection(check.collection)
      .where('status', '==', 'submagic_processing')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('No workflows in submagic_processing state');
    } else {
      const data = snapshot.docs[0].data();
      console.log('Submagic fields:', {
        submagicVideoId: data?.submagicVideoId,
        submagicProjectId: data?.submagicProjectId
      });
    }
  }

  process.exit(0);
}

main();
