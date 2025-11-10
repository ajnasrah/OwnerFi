/**
 * Check Abdullah's daily content workflows status
 */

import { db } from '../src/lib/firebase';
import { collection, query, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

async function checkAbdullahDailyWorkflows() {
  console.log('🔍 Checking Abdullah daily content workflows...\n');

  try {
    const q = query(
      collection(db, 'abdullah_workflow_queue'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(20)
    );

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} workflows\n`);

    const statusCounts: Record<string, number> = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const timestamp = data.updatedAt || data.createdAt || 0;
      const ageMinutes = Math.round((Date.now() - timestamp) / 60000);
      const createdAt = new Date(data.createdAt || 0).toLocaleString();

      console.log(`\nWorkflow: ${doc.id}`);
      console.log(`  Status: ${status}`);
      console.log(`  Created: ${createdAt}`);
      console.log(`  Age: ${ageMinutes} minutes`);
      console.log(`  Title: ${data.contentTitle || data.title || 'N/A'}`);
      console.log(`  Submagic ID: ${data.submagicProjectId || data.submagicVideoId || 'N/A'}`);
      console.log(`  Video URL: ${data.finalVideoUrl || data.submagicDownloadUrl ? 'EXISTS' : 'MISSING'}`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('\n📊 STATUS SUMMARY:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

checkAbdullahDailyWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
