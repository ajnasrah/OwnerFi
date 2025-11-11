import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function checkFailedPropertyWorkflows() {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('Failed to initialize Firebase Admin');
    process.exit(1);
  }

  console.log('🔍 Checking failed property workflows...\n');

  // Get all failed workflows (simple query, no compound index needed)
  const failedWorkflows = await (adminDb as any)
    .collection('property_workflows')
    .where('status', '==', 'failed')
    .get();

  if (failedWorkflows.empty) {
    console.log('✅ No failed workflows found');
    process.exit(0);
  }

  console.log(`Found ${failedWorkflows.size} failed workflows:\n`);

  const silencePaceErrors: any[] = [];
  const otherErrors: any[] = [];

  // Sort by createdAt descending
  const sortedDocs = failedWorkflows.docs.sort((a: any, b: any) => {
    return b.data().createdAt - a.data().createdAt;
  });

  sortedDocs.slice(0, 50).forEach((doc: any) => {
    const data = doc.data();
    const age = Math.round((Date.now() - data.createdAt) / (1000 * 60 * 60));

    const isSilencePaceError = data.error?.includes('removeSilencePace invalid enum value');

    const workflowInfo = {
      id: doc.id,
      property: data.propertyAddress,
      age: `${age}h ago`,
      error: data.error,
      heygenVideoId: data.heygenVideoId,
      createdAt: data.createdAt,
    };

    if (isSilencePaceError) {
      silencePaceErrors.push(workflowInfo);
    } else {
      otherErrors.push(workflowInfo);
    }
  });

  if (silencePaceErrors.length > 0) {
    console.log(`\n❌ Workflows failed due to removeSilencePace error (${silencePaceErrors.length}):`);
    console.log('These can be retried after deploying the fix!\n');

    silencePaceErrors.forEach((w, i) => {
      console.log(`${i + 1}. ${w.property}`);
      console.log(`   Age: ${w.age}`);
      console.log(`   HeyGen Video ID: ${w.heygenVideoId}`);
      console.log(`   Workflow ID: ${w.id}`);
      console.log('');
    });
  }

  if (otherErrors.length > 0) {
    console.log(`\n⚠️  Workflows failed due to other errors (${otherErrors.length}):\n`);

    otherErrors.forEach((w, i) => {
      console.log(`${i + 1}. ${w.property}`);
      console.log(`   Age: ${w.age}`);
      console.log(`   Error: ${w.error}`);
      console.log(`   Workflow ID: ${w.id}`);
      console.log('');
    });
  }

  console.log('\n📊 Summary:');
  console.log(`   Total failed: ${failedWorkflows.size}`);
  console.log(`   ├─ removeSilencePace errors: ${silencePaceErrors.length} (can be retried)`);
  console.log(`   └─ Other errors: ${otherErrors.length} (need investigation)`);

  console.log('\n💡 Next steps:');
  console.log('   1. Deploy the fix (removeSilencePace: "natural" instead of "off")');
  console.log('   2. Use scripts/retry-failed-property-workflows.ts to retry the failed workflows');
}

checkFailedPropertyWorkflows().catch(console.error);
