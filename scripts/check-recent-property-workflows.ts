import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function checkRecentPropertyWorkflows() {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('Failed to initialize Firebase Admin');
    process.exit(1);
  }

  console.log('🔍 Checking recent property workflows...\n');

  // Get recent workflows (last 48 hours)
  const cutoffTime = Date.now() - (48 * 60 * 60 * 1000);

  const recentWorkflows = await (adminDb as any)
    .collection('property_workflows')
    .get();

  if (recentWorkflows.empty) {
    console.log('✅ No workflows found');
    process.exit(0);
  }

  // Filter and sort in memory
  const workflows = recentWorkflows.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .filter((w: any) => w.createdAt >= cutoffTime)
    .sort((a: any, b: any) => b.createdAt - a.createdAt);

  console.log(`Found ${workflows.length} workflows in last 48 hours:\n`);

  const statusCount: any = {};
  const errorTypes: any = {};

  workflows.forEach((w: any) => {
    // Count statuses
    statusCount[w.status] = (statusCount[w.status] || 0) + 1;

    // Track errors
    if (w.error) {
      const isSilencePaceError = w.error.includes('removeSilencePace invalid enum value');
      const errorType = isSilencePaceError ? 'removeSilencePace' : 'other';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    }
  });

  console.log('📊 Status breakdown:');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  if (Object.keys(errorTypes).length > 0) {
    console.log('\n❌ Error breakdown:');
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  }

  // Show recent failed workflows
  const failedWorkflows = workflows.filter((w: any) =>
    w.status === 'failed' || w.error
  ).slice(0, 10);

  if (failedWorkflows.length > 0) {
    console.log(`\n\n🔴 Recent failed/errored workflows (showing ${failedWorkflows.length}):\n`);

    failedWorkflows.forEach((w: any, i: number) => {
      const age = Math.round((Date.now() - w.createdAt) / (1000 * 60 * 60));
      console.log(`${i + 1}. ${w.propertyAddress || 'Unknown'}`);
      console.log(`   Status: ${w.status}`);
      console.log(`   Age: ${age}h ago`);
      console.log(`   Error: ${w.error?.substring(0, 150) || 'None'}`);
      console.log(`   HeyGen ID: ${w.heygenVideoId || 'None'}`);
      console.log(`   Workflow ID: ${w.id}`);
      console.log('');
    });
  }

  // Show status distribution for last 10
  console.log('\n📋 Last 10 workflows:');
  workflows.slice(0, 10).forEach((w: any, i: number) => {
    const age = Math.round((Date.now() - w.createdAt) / (1000 * 60 * 60));
    const statusIcon = w.status === 'completed' ? '✅' : w.status === 'failed' ? '❌' : '🔄';
    console.log(`${i + 1}. ${statusIcon} ${w.propertyAddress || 'Unknown'} (${age}h ago) - ${w.status}`);
  });
}

checkRecentPropertyWorkflows().catch(console.error);
