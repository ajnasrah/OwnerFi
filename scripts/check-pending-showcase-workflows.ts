import { getAdminDb } from '../src/lib/firebase-admin';

async function checkPendingWorkflows() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to initialize Firebase Admin SDK');
    return;
  }

  const snapshot = await db
    .collection('propertyShowcaseWorkflows')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get();

  console.log(`\n=== PROPERTY SHOWCASE WORKFLOWS ===`);
  console.log(`Total pending workflows: ${snapshot.size}\n`);

  if (snapshot.size > 0) {
    console.log('First 10 pending workflows:\n');
    snapshot.docs.slice(0, 10).forEach((doc, i) => {
      const data = doc.data();
      const age = Date.now() - (data.createdAt || 0);
      const ageHours = Math.floor(age / (1000 * 60 * 60));
      const ageMinutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`${i + 1}. ${doc.id}`);
      console.log(`   Property: ${data.propertyId}`);
      console.log(`   Created: ${ageHours}h ${ageMinutes}m ago`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Has videoId: ${!!data.heygenVideoId}`);
      console.log(`   Variant: ${data.variant || 'unknown'}`);
      console.log('');
    });
  }

  // Check status distribution
  const allSnapshot = await db.collection('propertyShowcaseWorkflows').get();
  const statusCounts: Record<string, number> = {};
  allSnapshot.docs.forEach(doc => {
    const status = doc.data().status || 'undefined';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  console.log('\nAll workflows status distribution:', statusCounts);
  console.log(`\nTotal workflows in collection: ${allSnapshot.size}`);
}

checkPendingWorkflows().catch(console.error);
