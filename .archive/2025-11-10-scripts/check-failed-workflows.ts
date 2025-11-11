import { getAdminDb } from '../src/lib/firebase-admin';

async function checkFailedWorkflows() {
  const adminDb = await getAdminDb();

  const collections = [
    'ownerfi_workflow_queue',
    'carz_workflow_queue',
    'vassdistro_workflow_queue',
    'podcast_workflow_queue',
    'benefit_workflow_queue',
    'abdullah_workflow_queue',
    'property_videos'
  ];

  console.log('🔍 Checking for failed workflows in the last 3 days...\n');

  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

  for (const collection of collections) {
    try {
      const snapshot = await adminDb
        .collection(collection)
        .where('status', '==', 'failed')
        .where('createdAt', '>', threeDaysAgo)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      if (!snapshot.empty) {
        console.log(`\n📁 ${collection}:`);
        snapshot.forEach(doc => {
          const data = doc.data();
          const createdDate = new Date(data.createdAt).toLocaleString();
          console.log(`\n  ID: ${doc.id}`);
          console.log(`  Title: ${data.articleTitle || data.episodeTitle || data.benefitTitle || data.title || 'N/A'}`);
          console.log(`  Created: ${createdDate}`);
          console.log(`  Error: ${data.error || 'No error message'}`);
          console.log(`  HeyGen ID: ${data.heygenVideoId || 'N/A'}`);
          console.log(`  Submagic ID: ${data.submagicVideoId || data.submagicProjectId || 'N/A'}`);
        });
      }
    } catch (error) {
      console.error(`❌ Error checking ${collection}:`, error);
    }
  }
}

checkFailedWorkflows().catch(console.error);
