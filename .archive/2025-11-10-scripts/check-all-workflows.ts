import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function checkAllWorkflows() {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('Failed to initialize Firebase Admin');
    process.exit(1);
  }

  console.log('🔍 Checking workflows collection...\n');

  // Get all workflows
  const allWorkflows = await (adminDb as any)
    .collection('workflows')
    .get();

  if (allWorkflows.empty) {
    console.log('✅ No workflows found');
    process.exit(0);
  }

  // Filter recent workflows (last 48 hours)
  const cutoffTime = Date.now() - (48 * 60 * 60 * 1000);
  const workflows = allWorkflows.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .filter((w: any) => w.createdAt >= cutoffTime)
    .sort((a: any, b: any) => b.createdAt - a.createdAt);

  console.log(`Found ${allWorkflows.size} total workflows`);
  console.log(`${workflows.length} workflows in last 48 hours\n`);

  // Count by brand and status
  const brandStatus: any = {};
  const errorsByType: any = {};

  workflows.forEach((w: any) => {
    const brand = w.brand || 'unknown';
    const status = w.status || 'unknown';

    if (!brandStatus[brand]) {
      brandStatus[brand] = {};
    }
    brandStatus[brand][status] = (brandStatus[brand][status] || 0) + 1;

    // Track errors
    if (w.error) {
      if (w.error.includes('removeSilencePace')) {
        errorsByType['removeSilencePace'] = (errorsByType['removeSilencePace'] || 0) + 1;
      } else {
        errorsByType['other'] = (errorsByType['other'] || 0) + 1;
      }
    }
  });

  console.log('📊 Workflows by Brand & Status (last 48h):');
  Object.entries(brandStatus).forEach(([brand, statuses]: [string, any]) => {
    console.log(`\n  ${brand.toUpperCase()}:`);
    Object.entries(statuses).forEach(([status, count]) => {
      const icon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄';
      console.log(`    ${icon} ${status}: ${count}`);
    });
  });

  if (Object.keys(errorsByType).length > 0) {
    console.log('\n\n❌ Errors breakdown:');
    Object.entries(errorsByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  }

  // Show failed workflows with removeSilencePace error
  const silencePaceErrors = workflows.filter((w: any) =>
    w.error && w.error.includes('removeSilencePace')
  );

  if (silencePaceErrors.length > 0) {
    console.log(`\n\n🔴 Workflows with removeSilencePace error (${silencePaceErrors.length}):\n`);

    silencePaceErrors.slice(0, 10).forEach((w: any, i: number) => {
      const age = Math.round((Date.now() - w.createdAt) / (1000 * 60 * 60));
      console.log(`${i + 1}. ${w.articleTitle || w.propertyAddress || w.podcastTitle || 'Unknown'}`);
      console.log(`   Brand: ${w.brand}`);
      console.log(`   Status: ${w.status}`);
      console.log(`   Age: ${age}h ago`);
      console.log(`   HeyGen ID: ${w.heygenVideoId || 'None'}`);
      console.log(`   Error: ${w.error?.substring(0, 200)}`);
      console.log(`   Workflow ID: ${w.id}`);
      console.log('');
    });

    console.log('\n💡 These workflows can be retried after deploying the fix!');
  }

  // Show last 15 workflows
  console.log('\n\n📋 Last 15 workflows:');
  workflows.slice(0, 15).forEach((w: any, i: number) => {
    const age = Math.round((Date.now() - w.createdAt) / (1000 * 60 * 60));
    const statusIcon = w.status === 'completed' ? '✅' : w.status === 'failed' ? '❌' : '🔄';
    const title = w.articleTitle || w.propertyAddress || w.podcastTitle || 'Unknown';
    console.log(`${i + 1}. ${statusIcon} [${w.brand}] ${title} (${age}h ago) - ${w.status}`);
  });
}

checkAllWorkflows().catch(console.error);
