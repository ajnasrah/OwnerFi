import { getAdminDb } from '../src/lib/firebase-admin';

async function checkWorkflows() {
  console.log('=== Recent Workflows (Last 7 days) ===\n');

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin');
    return;
  }

  const brands = [
    { name: 'ownerfi', collection: 'ownerfi_workflow_queue' },
    { name: 'carz', collection: 'carz_workflow_queue' },
    { name: 'abdullah', collection: 'abdullah_workflow_queue' },
    { name: 'personal', collection: 'personal_workflow_queue' }
  ];

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  for (const brand of brands) {
    console.log(`${brand.name.toUpperCase()}:`);
    try {
      const snapshot = await db.collection(brand.collection)
        .where('createdAt', '>=', sevenDaysAgo)
        .orderBy('createdAt', 'desc')
        .limit(15)
        .get();

      if (snapshot.empty) {
        console.log('  No workflows in last 7 days\n');
        continue;
      }

      let completedCount = 0;
      let failedCount = 0;
      let otherCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'completed') completedCount++;
        else if (data.status === 'failed') failedCount++;
        else otherCount++;
      });

      console.log(`  Total: ${snapshot.size} workflows`);
      console.log(`  ✅ Completed: ${completedCount}`);
      console.log(`  ❌ Failed: ${failedCount}`);
      console.log(`  ⏳ Other: ${otherCount}`);

      // Show first 3 recent ones
      console.log(`\n  Recent workflows:`);
      let count = 0;
      snapshot.forEach(doc => {
        if (count >= 3) return;
        const data = doc.data();
        const date = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'unknown';
        console.log(`    ${data.status} | ${date}`);
        if (data.error) console.log(`      Error: ${data.error.substring(0, 80)}...`);
        count++;
      });
      console.log('');
    } catch (e: any) {
      console.log(`  Error: ${e.message}\n`);
    }
  }
}

checkWorkflows().catch(console.error);
