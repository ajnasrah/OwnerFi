#!/usr/bin/env node
// Find and retry the failed Nissan LEAF workflows

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Firebase credentials not configured');
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey })
});

const db = getFirestore();

async function retryFailedWorkflows() {
  console.log('🔍 Finding failed Nissan LEAF workflows...\n');

  const collections = [
    { name: 'carz_workflow_queue', brand: 'carz' },
    { name: 'ownerfi_workflow_queue', brand: 'ownerfi' }
  ];

  const failedWorkflows = [];

  for (const { name, brand } of collections) {
    const snapshot = await db.collection(name)
      .where('status', '==', 'failed')
      .where('error', '==', 'Submagic API call failed - no project ID received')
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      failedWorkflows.push({
        id: doc.id,
        brand,
        collection: name,
        articleTitle: data.articleTitle,
        articleId: data.articleId,
        createdAt: data.createdAt,
        error: data.error
      });
    });
  }

  console.log(`📋 Found ${failedWorkflows.length} failed workflows:\n`);

  for (const workflow of failedWorkflows) {
    console.log(`  • ${workflow.brand.toUpperCase()}: ${workflow.articleTitle}`);
    console.log(`    ID: ${workflow.id}`);
    console.log(`    Article ID: ${workflow.articleId}`);
    console.log(`    Error: ${workflow.error}\n`);
  }

  if (failedWorkflows.length === 0) {
    console.log('✅ No failed workflows found');
    return;
  }

  console.log('\n♻️  Retrying failed workflows...\n');

  for (const workflow of failedWorkflows) {
    console.log(`🔄 Retrying ${workflow.brand}: ${workflow.articleTitle}...`);

    try {
      // Reset workflow to pending
      await db.collection(workflow.collection).doc(workflow.id).update({
        status: 'pending',
        error: null,
        retryCount: (workflow.retryCount || 0) + 1,
        lastRetryAt: Date.now(),
        updatedAt: Date.now()
      });

      // Reset article to unprocessed
      const articleCollection = workflow.brand === 'carz' ? 'carz_articles' : 'ownerfi_articles';
      await db.collection(articleCollection).doc(workflow.articleId).update({
        processed: false,
        error: null
      });

      console.log(`   ✅ Reset workflow and article to pending\n`);
    } catch (error) {
      console.error(`   ❌ Error retrying workflow:`, error.message, '\n');
    }
  }

  console.log('✅ Done! Now trigger the workflow to process these articles:');
  console.log('\nFor Carz:');
  console.log('  POST https://ownerfi.ai/api/workflow/complete-viral');
  console.log('  Body: {"brand": "carz", "platforms": ["facebook", "instagram", "tiktok", "linkedin", "threads", "youtube"], "schedule": "immediate"}');
  console.log('\nFor OwnerFi:');
  console.log('  POST https://ownerfi.ai/api/workflow/complete-viral');
  console.log('  Body: {"brand": "ownerfi", "platforms": ["facebook", "instagram", "tiktok", "linkedin", "threads", "youtube"], "schedule": "immediate"}');
}

retryFailedWorkflows().catch(console.error);
